import { PartnersList } from '../components/PartnersList';

export function VendorsPage() {
  return (
    <PartnersList
      kind="vendors"
      title="Vendors"
      subtitle="The companies rooms are bought from"
      noun="vendor"
    />
  );
}
