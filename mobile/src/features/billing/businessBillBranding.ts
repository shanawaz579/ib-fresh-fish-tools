import type { BusinessProfile } from '../../types';

const DEFAULT_BILL_BRANDING = {
  name: 'SKS SEA FOODS',
  proprietor: 'Proprietor: Ibrahim Shaik',
  tagline: 'Fish Trading & Prawn Commission Agent',
  address: 'Sri Raghavendra Ice Factory, Near Indian Petrol Bunk, Muthukur Road, Nellore, AP',
  phone: '99087 04047',
};

export function getBusinessBillBranding(profile: BusinessProfile) {
  const configuredLegalName = profile.legal_name?.trim();
  const hasSpecificLegalName = Boolean(
    configuredLegalName
      && configuredLegalName.toLocaleLowerCase() !== profile.display_name.trim().toLocaleLowerCase(),
  );
  const name = hasSpecificLegalName ? configuredLegalName! : DEFAULT_BILL_BRANDING.name;
  const configuredDescription = profile.description?.trim();
  const proprietor = configuredDescription && configuredDescription !== 'Inventory & Sales Management'
    ? configuredDescription
    : DEFAULT_BILL_BRANDING.proprietor;
  const tagline = profile.tagline.trim() !== 'Fish Trading Tools'
    ? profile.tagline.trim()
    : DEFAULT_BILL_BRANDING.tagline;
  const address = profile.address?.trim() || DEFAULT_BILL_BRANDING.address;
  const phone = profile.phone?.trim() || DEFAULT_BILL_BRANDING.phone;
  const contactLine = [address, `Mobile: ${phone}`].filter(Boolean).join(' | ');

  return { name, proprietor, tagline, address, phone, contactLine };
}
