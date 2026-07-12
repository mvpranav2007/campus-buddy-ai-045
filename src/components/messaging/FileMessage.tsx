import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fileColorFor,
  fileIconFor,
  formatFileSize,
  isImageMime,
} from "@/lib/file-utils";
import { getSignedDownloadUrl, getSignedFileUrl } from "@/lib/messaging";
import { toast } from "sonner";

export type FileMessageData = {
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  file_path: string | null;
};

export function FileMessage({ msg }: { msg: FileMessageData }) {
  const name = msg.file_name ?? "file";
  const size = msg.file_size ?? 0;
  const mime = msg.file_type ?? "";
  const path = msg.file_path ?? "";
  const Icon = fileIconFor(mime, name);
  const color = fileColorFor(mime, name);
  const isImage = isImageMime(mime);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isImage || !path) return;
    getSignedFileUrl(path, 300)
      .then((u) => {
        if (alive) setImgUrl(u);
      })
      .catch(() => {
        if (alive) setImgError(true);
      });
    return () => {
      alive = false;
    };
  }, [isImage, path]);

  const onDownload = async () => {
    try {
      const url = await getSignedDownloadUrl(path, name);
      window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error("Couldn't download the file. Please try again.");
    }
  };

  const onOpen = async () => {
    try {
      const url = await getSignedFileUrl(path, 300);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open the file. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2 min-w-[220px] max-w-xs">
      {isImage ? (
        <button
          type="button"
          onClick={onOpen}
          className="group relative overflow-hidden rounded-md border border-border/60 bg-muted/40"
        >
          {imgUrl && !imgError ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img
              src={imgUrl}
              alt={name}
              className="max-h-64 w-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-40 items-center justify-center">
              {imgError ? (
                <Icon className={`size-8 ${color}`} />
              ) : (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </button>
      ) : null}

      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-2.5">
        <Icon className={`size-8 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={name}>
            {name}
          </div>
          <div className="text-xs text-muted-foreground">{formatFileSize(size)}</div>
        </div>
      </div>

      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1" onClick={onDownload}>
          <Download className="size-3.5" /> Download
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>
          <ExternalLink className="size-3.5" /> Open
        </Button>
      </div>
    </div>
  );
}