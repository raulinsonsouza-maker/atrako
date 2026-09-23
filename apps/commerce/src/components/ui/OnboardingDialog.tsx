"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

const stepContent = [
  {
    title: "Bem-vindo ao Signal",
    description:
      "Venda produtos digitais com checkout transparente, pixel e área de membros no mesmo lugar.",
  },
  {
    title: "Produtos e entrega",
    description:
      "Cadastre ebooks, cursos e bundles. A entrega e o acesso à área de membros acontecem após o pagamento.",
  },
  {
    title: "Checkout e upsell",
    description:
      "Use Mercado Pago, order bump e ofertas one-click para aumentar a conversão sem fricção.",
  },
  {
    title: "Pronto para vender",
    description:
      "Conecte o Mercado Pago, publique um produto e compartilhe o link. O painel acompanha tudo.",
  },
];

type OnboardingDialogProps = {
  triggerLabel?: string;
  className?: string;
};

export function OnboardingDialog({
  triggerLabel = "Tour rápido",
  className,
}: OnboardingDialogProps) {
  const [step, setStep] = useState(1);
  const totalSteps = stepContent.length;
  const current = stepContent[step - 1];

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setStep(1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 [&>button:last-child]:text-[var(--ink)]">
        <div className="p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-[216px] w-full rounded-[var(--radius-md)] object-cover"
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
            width={382}
            height={216}
            alt="Painel de vendas"
          />
        </div>
        <div className="space-y-6 px-6 pb-6 pt-3">
          <DialogHeader>
            <DialogTitle>{current.title}</DialogTitle>
            <DialogDescription>{current.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex justify-center space-x-1.5 max-sm:order-1">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full bg-[var(--accent)]",
                    index + 1 === step ? "opacity-100" : "opacity-20",
                  )}
                />
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Pular
                </Button>
              </DialogClose>
              {step < totalSteps ? (
                <Button
                  className="group"
                  type="button"
                  onClick={() => setStep((s) => Math.min(s + 1, totalSteps))}
                >
                  Próximo
                  <ArrowRight
                    className="-me-1 ms-1 opacity-60 transition-transform group-hover:translate-x-0.5"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                </Button>
              ) : (
                <DialogClose asChild>
                  <Button type="button">Começar</Button>
                </DialogClose>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingDialog;
