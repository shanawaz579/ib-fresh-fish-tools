import type { Customer } from '../types';

export function getCustomerLocation(customer: Customer | undefined): string {
  if (!customer) return '';
  return [customer.city, customer.state].filter(Boolean).join(', ') || customer.address || '';
}
