import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { CustomFieldDefDto } from '@tasku/types';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { SetCustomFieldValueDto } from './dto/set-value.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @Get('projects/:key/custom-fields')
  list(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomFieldDefDto[]> {
    return this.fields.list(key, user.id);
  }

  @Post('projects/:key/custom-fields')
  create(
    @Param('key') key: string,
    @Body() dto: CreateCustomFieldDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomFieldDefDto> {
    return this.fields.create(key, dto, user.id);
  }

  @Patch('custom-fields/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomFieldDefDto> {
    return this.fields.update(id, dto, user.id);
  }

  @Delete('custom-fields/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.fields.remove(id, user.id);
  }

  @Put('issues/:issueKey/fields/:fieldId')
  setValue(
    @Param('issueKey') issueKey: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: SetCustomFieldValueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fields.setValue(issueKey, fieldId, dto, user.id);
  }
}
