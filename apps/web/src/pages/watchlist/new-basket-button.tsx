import { useState } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { NewListForm } from "./new-list-form";

export function NewBasketButton({
  label = "New basket",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ActionStyle({ variant })}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Start a basket">
        <NewListForm onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}
