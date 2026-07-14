import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudyDetail } from "@/components/clinical/StudyDetail";
import {
  getStudyDetail,
  listClinicalStudyIds,
} from "@/lib/clinical-evidence/selectors";

type StudyPageProps = {
  params: Promise<{ studyId: string }>;
};

export function generateStaticParams() {
  return listClinicalStudyIds().map((studyId) => ({ studyId }));
}

export async function generateMetadata({
  params,
}: StudyPageProps): Promise<Metadata> {
  const { studyId } = await params;
  const detail = getStudyDetail(studyId);
  if (!detail) {
    return { title: "Study not found" };
  }
  return { title: detail.study.acronym?.trim() || detail.study.officialTitle };
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { studyId } = await params;
  const detail = getStudyDetail(studyId);
  if (!detail) {
    notFound();
  }
  return <StudyDetail detail={detail} />;
}
