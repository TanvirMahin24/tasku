import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldDefinition, CustomFieldType, Prisma } from '@prisma/client';
import type { CustomFieldDefDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toCustomFieldDefDto } from '../common/mappers';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { SetCustomFieldValueDto } from './dto/set-value.dto';

const SELECT_TYPES: CustomFieldType[] = [
  CustomFieldType.SELECT,
  CustomFieldType.MULTI_SELECT,
];

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  // --- Definitions (project settings) ---
  async list(key: string, userId: string): Promise<CustomFieldDefDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { projectId: project.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return defs.map(toCustomFieldDefDto);
  }

  async create(
    key: string,
    dto: CreateCustomFieldDto,
    userId: string,
  ): Promise<CustomFieldDefDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    this.requireOptions(dto.type, dto.options);
    const order = await this.prisma.customFieldDefinition.count({
      where: { projectId: project.id },
    });
    const def = await this.prisma.customFieldDefinition.create({
      data: {
        projectId: project.id,
        name: dto.name,
        type: dto.type,
        options: SELECT_TYPES.includes(dto.type)
          ? (dto.options ?? [])
          : Prisma.JsonNull,
        required: dto.required ?? false,
        order,
      },
    });
    return toCustomFieldDefDto(def);
  }

  async update(
    id: string,
    dto: UpdateCustomFieldDto,
    userId: string,
  ): Promise<CustomFieldDefDto> {
    const def = await this.requireDefForMember(id, userId);
    if (dto.options !== undefined) this.requireOptions(def.type, dto.options);
    const data: Prisma.CustomFieldDefinitionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.options !== undefined) {
      data.options = SELECT_TYPES.includes(def.type)
        ? dto.options
        : Prisma.JsonNull;
    }
    const updated = await this.prisma.customFieldDefinition.update({
      where: { id: def.id },
      data,
    });
    return toCustomFieldDefDto(updated);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const def = await this.requireDefForMember(id, userId);
    await this.prisma.customFieldDefinition.delete({ where: { id: def.id } });
    return { success: true };
  }

  // --- Values (per issue) ---
  async setValue(
    issueKey: string,
    fieldId: string,
    dto: SetCustomFieldValueDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    const def = await this.prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!def || def.projectId !== issue.projectId) {
      throw new NotFoundException('Custom field not found on this project');
    }
    const value = this.coerce(def, dto.value);
    if (value === null) {
      await this.prisma.customFieldValue.deleteMany({
        where: { fieldId, issueId: issue.id },
      });
      return { success: true };
    }
    await this.prisma.customFieldValue.upsert({
      where: { fieldId_issueId: { fieldId, issueId: issue.id } },
      create: { fieldId, issueId: issue.id, value },
      update: { value },
    });
    return { success: true };
  }

  // --- Helpers ---
  private requireOptions(type: CustomFieldType, options?: string[]): void {
    if (SELECT_TYPES.includes(type) && (!options || options.length === 0)) {
      throw new BadRequestException(
        'SELECT / MULTI_SELECT fields need at least one option',
      );
    }
  }

  private async requireDefForMember(
    id: string,
    userId: string,
  ): Promise<CustomFieldDefinition> {
    const def = await this.prisma.customFieldDefinition.findUnique({
      where: { id },
    });
    if (!def) throw new NotFoundException('Custom field not found');
    await this.membership.requireMembership(def.projectId, userId);
    return def;
  }

  /**
   * Validate + coerce a submitted value against the field type. Returns the
   * JSON-storable value, or null to clear the value.
   */
  private coerce(
    def: CustomFieldDefinition,
    value: unknown,
  ): Prisma.InputJsonValue | null {
    if (value === null || value === undefined || value === '') return null;
    const bad = (msg: string): never => {
      throw new BadRequestException(msg);
    };
    const opts = (def.options as string[] | null) ?? [];
    switch (def.type) {
      case CustomFieldType.TEXT:
      case CustomFieldType.TEXTAREA:
      case CustomFieldType.URL:
        if (typeof value !== 'string') bad(`${def.name} must be text`);
        return value as string;
      case CustomFieldType.NUMBER: {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(n)) bad(`${def.name} must be a number`);
        return n;
      }
      case CustomFieldType.CHECKBOX:
        return Boolean(value);
      case CustomFieldType.DATE:
        if (typeof value !== 'string') bad(`${def.name} must be a date`);
        return value as string;
      case CustomFieldType.USER:
        if (typeof value !== 'string') bad(`${def.name} must be a user`);
        return value as string;
      case CustomFieldType.SELECT:
        if (typeof value !== 'string') bad(`${def.name} must be one choice`);
        if (!opts.includes(value as string)) {
          bad(`"${String(value)}" is not an option for ${def.name}`);
        }
        return value as string;
      case CustomFieldType.MULTI_SELECT: {
        if (!Array.isArray(value)) bad(`${def.name} must be a list`);
        const arr = value as string[];
        for (const v of arr) {
          if (!opts.includes(v)) {
            bad(`"${v}" is not an option for ${def.name}`);
          }
        }
        return arr;
      }
      default:
        return null;
    }
  }
}
