import type { ComponentProps } from "react";
import { LpTestimonials } from "@/components/marketing/LpTestimonials";

type TestimonialsProps = ComponentProps<typeof LpTestimonials>;

export const AIR_FRYER_REVIEWS: TestimonialsProps = {
  sectionLabel: "Quem já cozinha com o guia",
  socialCount: "2.147",
  socialLabel: "pessoas já pararam de improvisar",
  subtitle: "Depoimentos de quem usa as receitas no dia a dia, sem complicação.",
  rating: 4.9,
  reviewCount: "2.147",
  distribution: [
    { stars: 5, percent: 93 },
    { stars: 4, percent: 5 },
    { stars: 3, percent: 1 },
    { stars: 2, percent: 1 },
    { stars: 1, percent: 0 },
  ],
  reviews: [
    {
      name: "Camila R.",
      date: "11 de setembro de 2026",
      rating: 5,
      text: "Eu ligava a Air Fryer e ficava sem ideia. No primeiro dia já fiz batata e frango. Fácil, gostoso e a louça quase não suja.",
    },
    {
      name: "Juliana Mota",
      date: "4 de setembro de 2026",
      rating: 5,
      text: "Salva a semana inteira. Chego cansada, escolho uma receita e em pouco tempo tem jantar na mesa. Meu marido pediu para repetir.",
    },
    {
      name: "Renata Souza",
      date: "28 de agosto de 2026",
      rating: 5,
      text: "Paguei barato e valeu. As 50 ideias tiram a pressão de inventar o que fazer. Tem opção rápida para o dia corrido.",
    },
    {
      name: "Patrícia A.",
      date: "19 de agosto de 2026",
      rating: 4,
      text: "Bem direto, sem enrolação. Abro no celular na bancada e vou seguindo. Só achei que podia ter mais opções de sobremesa.",
    },
  ],
};

export const PLANTAS_REVIEWS: TestimonialsProps = {
  sectionLabel: "Quem já consulta o Tratado",
  socialCount: "1.392",
  socialLabel: "pessoas já deixaram o Google de lado",
  subtitle: "Quem queria informação organizada, sem ficar pulando de site em site.",
  rating: 4.9,
  reviewCount: "1.392",
  distribution: [
    { stars: 5, percent: 93 },
    { stars: 4, percent: 5 },
    { stars: 3, percent: 1 },
    { stars: 2, percent: 1 },
    { stars: 1, percent: 0 },
  ],
  reviews: [
    {
      name: "Helena Martins",
      date: "10 de setembro de 2026",
      rating: 5,
      text: "Eu já fazia chá, mas ficava na dúvida do preparo. Agora abro o e-book e consulto parte da planta, cuidado e modo de fazer.",
    },
    {
      name: "Márcia Oliveira",
      date: "2 de setembro de 2026",
      rating: 5,
      text: "Organização excelente. Ficou bem mais claro para o dia a dia. Minha mãe também passou a consultar comigo.",
    },
    {
      name: "Simone Costa",
      date: "24 de agosto de 2026",
      rating: 5,
      text: "Comprei para ter tudo em um lugar só. Prefiro isso do que ficar em dez sites diferentes, cada um falando uma coisa.",
    },
    {
      name: "Luciana Mendes",
      date: "15 de agosto de 2026",
      rating: 4,
      text: "Material bem feito e fácil de ler no celular. Gostei do tom cuidadoso. Queria ainda mais plantas no próximo volume.",
    },
  ],
};

export const BOLOS_REVIEWS: TestimonialsProps = {
  sectionLabel: "Quem já assou com o guia",
  socialCount: "2.486",
  socialLabel: "pessoas já fizeram bolo sem estresse",
  subtitle: "Resultados de quem queria receita clara, que sobe e fica gostosa de verdade.",
  rating: 4.9,
  reviewCount: "2.486",
  distribution: [
    { stars: 5, percent: 93 },
    { stars: 4, percent: 5 },
    { stars: 3, percent: 1 },
    { stars: 2, percent: 1 },
    { stars: 1, percent: 0 },
  ],
  reviews: [
    {
      name: "Amanda Ribeiro",
      date: "12 de setembro de 2026",
      rating: 5,
      text: "Fiz o bolo de chocolate no domingo e não sobrou fatia. Passo a passo claro e com ingredientes que eu já tinha em casa.",
    },
    {
      name: "Fernanda Dias",
      date: "5 de setembro de 2026",
      rating: 5,
      text: "Eu sempre errava ponto e tempo de forno. Com esse e-book saiu fofinho de primeira. Já marquei outras três receitas.",
    },
    {
      name: "Carla Nogueira",
      date: "27 de agosto de 2026",
      rating: 5,
      text: "Perfeito para lanche da tarde. Escolhi um simples, fiz com as crianças e ficou delicioso. Virou nosso domingo.",
    },
    {
      name: "Beatriz Ramos",
      date: "16 de agosto de 2026",
      rating: 4,
      text: "Vale pelo tanto de opções. Não preciso mais caçar receita no WhatsApp da família. Só senti falta de mais bolos sem lactose.",
    },
  ],
};
