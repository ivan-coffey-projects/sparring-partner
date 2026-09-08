import { MethodologyForm } from "@/components/coach/methodology-form";

export const metadata = { title: "New methodology" };

export default function NewMethodologyPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        New methodology
      </h1>
      <MethodologyForm
        initial={{
          id: null,
          name: "",
          description: "",
          entries: [{ id: null, number: "1.1", title: "", text: "" }],
        }}
      />
    </div>
  );
}
