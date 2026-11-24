import { notFound } from "next/navigation";
import { PublicLaboratories, type DiscoveryParams } from "@/components/PublicLaboratories";
import { parseScienceSubject } from "@/components/ScienceDestinations";

export default async function SubjectHubPage(props: {
  params: Promise<{ subject: string }>;
  searchParams: Promise<DiscoveryParams>;
}) {
  const [params, filters] = await Promise.all([props.params, props.searchParams]);
  const subject = parseScienceSubject(params.subject);
  if (!subject) notFound();

  return <PublicLaboratories params={filters} subjectPath={subject} />;
}
