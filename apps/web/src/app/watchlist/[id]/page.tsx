import { notFound } from "next/navigation";
import { listDetail } from "@/lib/watchlist/queries";
import { ListView } from "./list-view";

export default async function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await listDetail(id);
  if (!list) notFound();

  return <ListView list={list} />;
}
