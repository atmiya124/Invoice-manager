import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-slate-500 text-sm mb-6">
        Fill in the details below. These will be used as defaults when creating invoices.
      </p>
      <ClientForm />
    </div>
  );
}
