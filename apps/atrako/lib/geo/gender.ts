/**
 * Estimativa de gênero pelo primeiro nome. Nome ambíguo ou ausente fica vazio.
 * Não é campo da loja.
 */

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const FEMALE = new Set(
  `
  adelaide adriana agatha agnes aide aila aileen aimee aina alana alberta
  alcione alessandra alexandra alice alicia aline alinne alzira amanda amelia
  ana anabela andreia andressa angela angelica angelina antonella antonia
  aparecida ariane ariane arlete aurea aurora barbara beatriz benedita
  berenice bernadete betina bianca bruna camila camile carina carla carmem
  carmen carolina cassia catarina cecilia celia celina cida cinthia cintia
  clara claudia cleide cleonice conceicao consuelo cristiane cristina daiane
  dalva daniela debora deborah denise diana dilma dinah dirce dora doraci
  edna edneia eduarda elaine elba elena eliane elisa elisabete elisangela
  elizabete elizete eloisa elza emanuela emanuelle emilia eni erica erika
  esther eugenia eunice eva fabiana fabiane fatima fernanda filomena flavia
  flor florinda francisca gabriela geovana gilda gislaine giovana giselle
  glaucia gloria graziele helena helga heloisa hilda iara idalina ilza
  ines iolanda iracema irene iris isabel isabela isabella isadora isis
  ivete ivone izabel jacira janaina jane janete jessica joana joice josefa
  josiane julia juliana julieta karina karla kate kathleen kelly keila
  lais lara larissa laura lavinia leila lena lenira lidia ligia lilian
  linda livia lorena lorena louisa luana lucelia lucia luciana luciene
  ludmila luiza luzia lydia mabel madeleine madalena maite manuela mara
  marcela marcia maria mariana marilda marilene marina marisa marlene
  martha matilde meire melissa mercedes mia michele milena miriam monica
  nadia naila naomi natalia nathalia neide nelly neuza nilza noemia
  norma olga olivia paloma patricia paula paulina penha pietra priscila
  raquel rebeca regina renata rita roberta rosa rosana rosangela rose
  rosemarie rosinha ruth sabrina salete samanta sandra sara sarah selma
  sheila silvana silvia simone sofia solange sonia stella sueli suely
  susana suzana tania tatiana tatiane telma terezinha thais thalia
  valentina valeria vanessa vera veronica vitoria vivian viviane wanda
  yasmin yara yolanda zelia zenaide zilda zuleica
  acacia anali andrea anik cristiana danielle danielly deisi edilaine eliana ester franciele gilvaneide
  gilvania gilvanez gisele gleice graziella graziela henriqueta itaraiacy
  ivona izabela janine jaqueline jeanine joelma joicilene josemary juliane
  jussara karen karili karin karine katia katiane leticia lidiane lilia liza
  lorayne lorrane luciane lucilene magda marcelle mariangela marianna
  marilyn marinna mayara mercia michelle mirela mirella mirelle mirian
  monique myrian nailu narah nayara nicole pamela paola quezia rafaela raissa rayane rayssa
  rosiane samantha samya stephanie suemy susy tahiana taina tamires
  tarciana tarsia tathiane teresa tereza thaina thalita valquiria vania
  `
    .trim()
    .split(/\s+/),
);

const MALE = new Set(
  `
  abel adalberto adilson adriano agnaldo alberto alceu aldo alexandre
  alfredo almir alvaro amadeu amaro ander anderson andre antonio
  apolonio ari arielson armando arnaldo artur arthur augusto aurelio
  benedito benicio benjamim benjamin bernardo bruno caetano caio
  carlito carlos cassio celso cesar cicero claudio cleber clemente
  cristian cristovao daniel danilo dante dario davi david denilson
  djalma domingos douglas durval edgar edmilson edson eduardo elias
  eliseu emanuel emerson emilio enzo eric erico ernesto eugenio
  evaldo evandro everton ezequiel fabiano fabio fabricio felipe
  felix fernando flavio francisco frederico gabriel gael geraldo
  germano gerson gilberto gilmar giovanni guilherme gustavo heitor
  helder helio henrique herculano hermes higor hugo humberto igor
  inacio isaac isaak isaias italo ivan ivanilson ivaldo jackson
  jair jairo jansen jaime jeferson jefferson joao joaquim jonas
  jorge jose josue julio junior jurandir laerte lauro leandro
  leonardo levi lincoln lorenzo lucas luciano ludovico luis luiz
  manoel marcelo marcio marco marcos mario marlon matheus mauricio
  maurilio mauro miguel moacir moises murilo nelson nestor newton
  nicolas nilo nilson nilton noel norberto octavio odair omar
  orlando osmar osvaldo otavio oswaldo paulo pedro raul reginaldo
  reinaldo renan renato ricardo roberto robson rodrigo rogerio
  romulo ronaldo roni rubens rui ruy salvador samuel sandro
  sebastiao sergio severino sidney silvio tadeu teodoro thiago
  tiago tomas valdemar valdir vanderlei vicente victor vinicius
  vitor wagner walter washington wellington willian william wilson
  xavier
  ademir ailton airton alessandro arilson diogo gideoni jean joel kaio
  kaique lemuel marcus michel raimundo thomas wanderley wanderson wender
  ysrael
  `
    .trim()
    .split(/\s+/),
);

/** Primeiro nome → F, M, ou null quando ambíguo ou desconhecido. */
export function genderFromName(name: string | null | undefined): "F" | "M" | null {
  const first = fold(name ?? "").split(" ")[0] ?? "";
  if (first.length < 2) return null;
  const female = FEMALE.has(first);
  const male = MALE.has(first);
  if (female && !male) return "F";
  if (male && !female) return "M";
  return null;
}
