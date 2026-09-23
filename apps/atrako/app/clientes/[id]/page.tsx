"use client";

import { useParams } from "next/navigation";
import { ClienteDashboard } from "./ClienteDashboard";

export default function ClienteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  return <ClienteDashboard id={id} />;
}
