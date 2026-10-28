import { useFieldValue, useTranslate } from "ra-core";
import { createRef, useCallback, useState } from "react";
import type { ReactCropperElement } from "react-cropper";
import { Cropper } from "react-cropper";
import { useDropzone } from "react-dropzone";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import "cropperjs/dist/cropper.css";

import type { ImageEditorDialogProps } from "./ImageEditorField";

const ImageEditorDialog = (props: ImageEditorDialogProps) => {
  const translate = useTranslate();
  const { setValue, handleSubmit } = useFormContext();
  const cropperRef = createRef<ReactCropperElement>();
  const initialValue = useFieldValue({ source: props.source });
  const [file, setFile] = useState<File | undefined>();
  const [imageSrc, setImageSrc] = useState<string | undefined>(
    initialValue?.src,
  );
  const onDrop = useCallback((files: File[]) => {
    const preview = URL.createObjectURL(files[0]);
    setFile(files[0]);
    setImageSrc(preview);
  }, []);

  const updateImage = () => {
    const cropper = cropperRef.current?.cropper;
    const croppedImage = cropper?.getCroppedCanvas().toDataURL();
    if (croppedImage) {
      setImageSrc(croppedImage);

      const newFile = file ?? new File([], initialValue?.src);
      setValue(
        props.source,
        {
          src: croppedImage,
          title: newFile.name,
          rawFile: newFile,
        },
        { shouldDirty: true },
      );
      props.onClose();

      if (props.onSave) {
        handleSubmit(props.onSave)();
      }
    }
  };

  const deleteImage = () => {
    setValue(props.source, null, { shouldDirty: true });
    if (props.onSave) {
      handleSubmit(props.onSave)();
    }
    setImageSrc(undefined);
    props.onClose();
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/jpeg": [".jpeg", ".png"] },
    onDrop,
    maxFiles: 1,
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      {props.type === "avatar" && (
        <style>
          {`
                        .cropper-crop-box,
                        .cropper-view-box {
                            border-radius: 50%;
                        }
                    `}
        </style>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate("crm.image_editor.title", {
              _: "Upload and resize image",
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 justify-center">
          <div
            className="flex flex-row justify-center bg-gray-50 cursor-pointer p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <p className="text-gray-600">
              {translate("crm.image_editor.drop_hint", {
                _: "Drop a file to upload, or click to select it.",
              })}
            </p>
          </div>

          {imageSrc && (
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              aspectRatio={1}
              guides={false}
              cropBoxResizable={false}
            />
          )}
        </div>

        <DialogFooter className="flex justify-between w-full">
          <Button type="button" onClick={updateImage}>
            {translate("crm.image_editor.update_image")}
          </Button>
          <Button type="button" variant="destructive" onClick={deleteImage}>
            {translate("ra.action.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditorDialog;
