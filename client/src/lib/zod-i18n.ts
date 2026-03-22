import { z } from 'zod';
import i18n from './i18n';

// Set up Zod error map for internationalization
z.setErrorMap((issue, ctx) => {
  const t = i18n.t.bind(i18n);
  
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: t('forms.validation.invalidString', { defaultValue: ctx.defaultError }) };
      }
      if (issue.expected === 'number') {
        return { message: t('forms.validation.invalidNumber', { defaultValue: ctx.defaultError }) };
      }
      if (issue.expected === 'boolean') {
        return { message: t('forms.validation.invalidBoolean', { defaultValue: ctx.defaultError }) };
      }
      return { message: t('forms.validation.invalidType', { expected: issue.expected, defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_literal:
      return { message: t('forms.validation.invalidLiteral', { expected: issue.expected, defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.unrecognized_keys:
      return { message: t('forms.validation.unrecognizedKeys', { keys: issue.keys.join(', '), defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_union:
      return { message: t('forms.validation.invalidUnion', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: t('forms.validation.invalidUnionDiscriminator', { options: issue.options.join(', '), defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_enum_value:
      return { message: t('forms.validation.invalidEnumValue', { options: issue.options?.join(', '), defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_arguments:
      return { message: t('forms.validation.invalidArguments', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_return_type:
      return { message: t('forms.validation.invalidReturnType', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_date:
      return { message: t('forms.validation.invalidDate', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: t('forms.validation.invalidEmail', { defaultValue: ctx.defaultError }) };
      }
      if (issue.validation === 'url') {
        return { message: t('forms.validation.invalidUrl', { defaultValue: ctx.defaultError }) };
      }
      if (issue.validation === 'uuid') {
        return { message: t('forms.validation.invalidUuid', { defaultValue: ctx.defaultError }) };
      }
      if (issue.validation === 'regex') {
        return { message: t('forms.validation.invalidFormat', { defaultValue: ctx.defaultError }) };
      }
      return { message: t('forms.validation.invalidString', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.too_small:
      if (issue.type === 'array') {
        return { message: t('forms.validation.arrayTooSmall', { minimum: issue.minimum, defaultValue: ctx.defaultError }) };
      }
      if (issue.type === 'string') {
        return { message: t('forms.validation.stringTooShort', { minimum: issue.minimum, defaultValue: ctx.defaultError }) };
      }
      if (issue.type === 'number') {
        return { message: t('forms.validation.numberTooSmall', { minimum: issue.minimum, defaultValue: ctx.defaultError }) };
      }
      return { message: t('forms.validation.tooSmall', { minimum: issue.minimum, defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.too_big:
      if (issue.type === 'array') {
        return { message: t('forms.validation.arrayTooBig', { maximum: issue.maximum, defaultValue: ctx.defaultError }) };
      }
      if (issue.type === 'string') {
        return { message: t('forms.validation.stringTooLong', { maximum: issue.maximum, defaultValue: ctx.defaultError }) };
      }
      if (issue.type === 'number') {
        return { message: t('forms.validation.numberTooBig', { maximum: issue.maximum, defaultValue: ctx.defaultError }) };
      }
      return { message: t('forms.validation.tooBig', { maximum: issue.maximum, defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.invalid_intersection_types:
      return { message: t('forms.validation.invalidIntersection', { defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.not_multiple_of:
      return { message: t('forms.validation.notMultipleOf', { multipleOf: issue.multipleOf, defaultValue: ctx.defaultError }) };
      
    case z.ZodIssueCode.not_finite:
      return { message: t('forms.validation.notFinite', { defaultValue: ctx.defaultError }) };
      
    default:
      return { message: t('forms.validation.invalid', { defaultValue: ctx.defaultError }) };
  }
});

export default z;