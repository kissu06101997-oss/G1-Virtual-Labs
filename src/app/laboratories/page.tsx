import { PublicLaboratories, type DiscoveryParams } from "@/components/PublicLaboratories";

export default async function LaboratoriesPage({ searchParams }: { searchParams: Promise<DiscoveryParams> }) {
  return <PublicLaboratories params={await searchParams} />;
}
