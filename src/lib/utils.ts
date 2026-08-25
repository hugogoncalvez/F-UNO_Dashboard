const TEAM_COLORS: [string[], string][] = [
  [["Red Bull"], "3671C6"],
  [["McLaren"], "FF8000"],
  [["Ferrari"], "E8002D"],
  [["Mercedes"], "27F4D2"],
  [["Aston Martin"], "229971"],
  [["Alpine"], "0093CC"],
  [["Williams"], "64C4FF"],
  [["RB"], "6692FF"],
  [["Haas"], "B6BABD"],
  [["Sauber", "Kick"], "52E252"],
];

export function teamColor(team: string): string {
  const lower = team.toLowerCase();
  for (const [names, color] of TEAM_COLORS) {
    if (names.some((n) => lower.includes(n.toLowerCase()))) return color;
  }
  return "888888";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

const NATIONALITY_CODES: [string[], string][] = [
  [["british", "english"], "GB"],
  [["american"], "US"],
  [["dutch"], "NL"],
  [["german"], "DE"],
  [["french"], "FR"],
  [["italian"], "IT"],
  [["spanish"], "ES"],
  [["australian"], "AU"],
  [["austrian"], "AT"],
  [["argentine", "argentinian"], "AR"],
  [["belgian"], "BE"],
  [["brazilian"], "BR"],
  [["canadian"], "CA"],
  [["chilean"], "CL"],
  [["chinese"], "CN"],
  [["colombian"], "CO"],
  [["czech"], "CZ"],
  [["danish"], "DK"],
  [["finnish"], "FI"],
  [["hungarian"], "HU"],
  [["indian"], "IN"],
  [["indonesian"], "ID"],
  [["irish"], "IE"],
  [["japanese"], "JP"],
  [["mexican"], "MX"],
  [["monegasque"], "MC"],
  [["new zealander"], "NZ"],
  [["polish"], "PL"],
  [["portuguese"], "PT"],
  [["russian"], "RU"],
  [["saudi arabian"], "SA"],
  [["south african"], "ZA"],
  [["swedish"], "SE"],
  [["swiss"], "CH"],
  [["thai"], "TH"],
  [["venezuelan"], "VE"],
];

const COUNTRY_CODES: [string[], string][] = [
  [["australia"], "AU"],
  [["austria"], "AT"],
  [["azerbaijan"], "AZ"],
  [["argentina"], "AR"],
  [["bahrain"], "BH"],
  [["belgium"], "BE"],
  [["brazil"], "BR"],
  [["canada"], "CA"],
  [["chile"], "CL"],
  [["china"], "CN"],
  [["colombia"], "CO"],
  [["czech"], "CZ"],
  [["denmark"], "DK"],
  [["finland"], "FI"],
  [["france"], "FR"],
  [["germany"], "DE"],
  [["great britain", "united kingdom"], "GB"],
  [["hungary"], "HU"],
  [["india"], "IN"],
  [["indonesia"], "ID"],
  [["ireland"], "IE"],
  [["italy"], "IT"],
  [["japan"], "JP"],
  [["mexico"], "MX"],
  [["monaco"], "MC"],
  [["morocco"], "MA"],
  [["netherlands"], "NL"],
  [["new zealand"], "NZ"],
  [["poland"], "PL"],
  [["portugal"], "PT"],
  [["qatar"], "QA"],
  [["russia"], "RU"],
  [["saudi arabia"], "SA"],
  [["singapore"], "SG"],
  [["south africa"], "ZA"],
  [["spain"], "ES"],
  [["sweden"], "SE"],
  [["switzerland"], "CH"],
  [["thailand"], "TH"],
  [["turkey"], "TR"],
  [["united arab emirates"], "AE"],
  [["united states", "usa", "u.s.a."], "US"],
  [["venezuela"], "VE"],
];

function flagFromCode(code: string): string {
  return code
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function countryFlag(country: string): string {
  const lower = country.toLowerCase();
  for (const [names, code] of COUNTRY_CODES) {
    if (names.some((n) => lower.includes(n))) return flagFromCode(code);
  }
  return "";
}

export function flagEmoji(nationality: string): string {
  const lower = nationality.toLowerCase();
  for (const [names, code] of NATIONALITY_CODES) {
    if (names.some((n) => lower.includes(n))) {
      return flagFromCode(code);
    }
  }
  return "";
}

const NATIONALITY_ES: Record<string, string> = {
  British: "Británica",
  American: "Estadounidense",
  Dutch: "Neerlandesa",
  German: "Alemana",
  French: "Francesa",
  Italian: "Italiana",
  Spanish: "Española",
  Australian: "Australiana",
  Austrian: "Austriaca",
  Argentine: "Argentina",
  Belgian: "Belga",
  Brazilian: "Brasileña",
  Canadian: "Canadiense",
  Chilean: "Chilena",
  Chinese: "China",
  Colombian: "Colombiana",
  Czech: "Checa",
  Danish: "Danesa",
  Finnish: "Finlandesa",
  Hungarian: "Húngara",
  Indian: "India",
  Indonesian: "Indonesia",
  Irish: "Irlandesa",
  Japanese: "Japonesa",
  Mexican: "Mexicana",
  Monegasque: "Monegasca",
  "New Zealander": "Neozelandesa",
  Polish: "Polaca",
  Portuguese: "Portuguesa",
  Russian: "Rusa",
  "Saudi Arabian": "Saudí",
  "South African": "Sudafricana",
  Swedish: "Sueca",
  Swiss: "Suiza",
  Thai: "Tailandesa",
  Venezuelan: "Venezolana",
};

export function nationalityEs(nationality: string): string {
  return NATIONALITY_ES[nationality] ?? nationality;
}

export function headshotTransform(url: string | null, col: string): string | null {
  if (!url) return null;
  return url.replace(".transform/1col/", `.transform/${col}/`);
}
