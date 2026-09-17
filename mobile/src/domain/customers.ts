import type { Customer } from '../types';

type CustomerLocation = Pick<Customer, 'city' | 'state' | 'address'>;

export function getCustomerLocation(customer: CustomerLocation | undefined): string {
  if (!customer) return '';
  return [customer.city, customer.state].filter(Boolean).join(', ') || customer.address || '';
}

function normalizeText(value?: string): string {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? '';
}

function normalizePhone(value?: string): string {
  return value?.replace(/\D/g, '') ?? '';
}

export function findDuplicateCustomer(
  customers: Customer[],
  candidate: Pick<Customer, 'name' | 'city' | 'state' | 'address' | 'phone' | 'email'>,
  excludeId?: number,
): Customer | undefined {
  const name = normalizeText(candidate.name);
  const location = normalizeText(getCustomerLocation(candidate));
  const phone = normalizePhone(candidate.phone);
  const email = normalizeText(candidate.email);

  return customers.find((customer) => {
    if (customer.id === excludeId) return false;
    if (phone && normalizePhone(customer.phone) === phone) return true;
    if (email && normalizeText(customer.email) === email) return true;
    if (normalizeText(customer.name) !== name) return false;
    const existingLocation = normalizeText(getCustomerLocation(customer));
    return !location || !existingLocation || existingLocation === location;
  });
}
