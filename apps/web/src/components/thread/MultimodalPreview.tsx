import React, { useState } from "react";
import Image from "next/image";
import { File, X as XIcon } from "lucide-react";
import type { ContentBlock } from "@langchain/core/messages";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";

export interface MultimodalPreviewProps {
  block: ContentBlock.Multimodal.Data;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const ImageModal = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <DialogContent className="max-h-[90vh] w-full max-w-4xl border-0 bg-white p-0 dark:bg-black">
      <DialogHeader className="mx-4 my-6 text-black dark:text-white">
        <DialogTitle>Artifact Preview</DialogTitle>
        <DialogDescription>
          Preview of the selected image artifact.
        </DialogDescription>
      </DialogHeader>
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 p-4">
        <div className="relative aspect-auto max-h-[90vh] max-w-full">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={800}
            className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
            style={{ aspectRatio: "auto" }}
            priority
          />
        </div>
      </div>
    </DialogContent>
  );
};

export const MultimodalPreview: React.FC<MultimodalPreviewProps> = ({
  block,
  removable = false,
  onRemove,
  className,
  size = "md",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Image block with base64 data
  if (
    block.type === "image" &&
    typeof block.mime_type === "string" &&
    block.mime_type.startsWith("image/")
  ) {
    const url =
      typeof block.data === "string" && block.data.startsWith("data:")
        ? block.data
        : `data:${block.mime_type};base64,${block.data}`;

    const altText = (block.metadata?.name ?? "uploaded image") as string;
    let imgClass: string =
      "rounded-md object-cover h-16 w-16 text-lg cursor-pointer hover:opacity-80 transition-opacity";
    if (size === "sm")
      imgClass =
        "rounded-md object-cover h-10 w-10 text-base cursor-pointer hover:opacity-80 transition-opacity";
    if (size === "lg")
      imgClass =
        "rounded-md object-cover h-24 w-24 text-xl cursor-pointer hover:opacity-80 transition-opacity";

    return (
      <div className={cn("relative inline-block", className)}>
        <Dialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        >
          <DialogTrigger asChild>
            <Image
              src={url}
              alt={altText}
              className={imgClass}
              width={size === "sm" ? 40 : size === "md" ? 64 : 96}
              height={size === "sm" ? 40 : size === "md" ? 64 : 96}
            />
          </DialogTrigger>
          <ImageModal
            src={url}
            alt={altText}
          />
        </Dialog>
        {removable && (
          <button
            type="button"
            className="absolute top-1 right-1 z-10 rounded-full bg-gray-500 text-white hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Image block with URL
  if (block.type === "image" && block.source_type === "url" && block.url) {
    const altText = (block.metadata?.name ?? "uploaded image") as string;
    let imgClass: string =
      "rounded-md object-cover h-16 w-16 text-lg cursor-pointer hover:opacity-80 transition-opacity";
    if (size === "sm")
      imgClass =
        "rounded-md object-cover h-10 w-10 text-base cursor-pointer hover:opacity-80 transition-opacity";
    if (size === "lg")
      imgClass =
        "rounded-md object-cover h-24 w-24 text-xl cursor-pointer hover:opacity-80 transition-opacity";

    return (
      <div className={cn("relative inline-block", className)}>
        <Dialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        >
          <DialogTrigger asChild>
            <Image
              src={block.url}
              alt={altText}
              className={imgClass}
              width={size === "sm" ? 40 : size === "md" ? 64 : 96}
              height={size === "sm" ? 40 : size === "md" ? 64 : 96}
            />
          </DialogTrigger>
          <ImageModal
            src={block.url}
            alt={altText}
          />
        </Dialog>
        {removable && (
          <button
            type="button"
            className="absolute top-1 right-1 z-10 rounded-full bg-gray-500 text-white hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // PDF block
  if (
    block.type === "file" &&
    block.source_type === "base64" &&
    block.mime_type === "application/pdf"
  ) {
    const filename =
      block.metadata?.filename || block.metadata?.name || "PDF file";
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-md border bg-gray-100 px-3 py-2",
          className,
        )}
      >
        <div className="flex flex-shrink-0 flex-col items-start justify-start">
          <File
            className={cn(
              "text-teal-700",
              size === "sm" ? "h-5 w-5" : "h-7 w-7",
            )}
          />
        </div>
        <span
          className={cn("min-w-0 flex-1 text-sm break-all text-gray-800")}
          style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
        >
          {String(filename)}
        </span>
        {removable && (
          <button
            type="button"
            className="ml-2 self-start rounded-full bg-gray-200 p-1 text-teal-700 hover:bg-gray-300"
            onClick={onRemove}
            aria-label="Remove PDF"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-gray-100 px-3 py-2 text-gray-500",
        className,
      )}
    >
      <File className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs">Unsupported file type</span>
      {removable && (
        <button
          type="button"
          className="ml-2 rounded-full bg-gray-200 p-1 text-gray-500 hover:bg-gray-300"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
