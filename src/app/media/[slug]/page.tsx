import { getMediaBySlug } from '@/lib/media-service';

type Props = {
  params: {
    slug: string;
  };
};

export default async function MediaPage({ params }: Props) {
  const media = await getMediaBySlug(params.slug);

  if (!media) {
    return <div>Media not found</div>;
  }

  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold tracking-tight">
          {media.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          (ID: {media.id} / Slug: {media.slug})
        </p>
      </div>
    </div>
  );
}
