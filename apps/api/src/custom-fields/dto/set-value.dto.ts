import { Allow } from 'class-validator';
import type {
  SetCustomFieldValueDto as ISetCustomFieldValueDto,
  CustomFieldValue,
} from '@tasku/types';

export class SetCustomFieldValueDto implements ISetCustomFieldValueDto {
  // Free-form JSON — validated/coerced against the field type in the service.
  // `@Allow()` keeps it past the whitelisting ValidationPipe.
  @Allow()
  value: CustomFieldValue;
}
