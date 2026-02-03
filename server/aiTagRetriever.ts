import { OpenAI } from "openai";
import { eq } from "drizzle-orm";
import { tags, tagsSchema } from "~/data/tags";
import { env } from "~/env";
import { type Tags } from "~/data/tags"; // Import the 'Tags' type from the appropriate module
import { db } from "~/db/db";
import { flat, flatToTag, tag } from "~/db/schema";

/**
 * TODO
 * Gerade werden für jede Wohnung ein neuer Thread erstellt.
 * Das ist Teurer und dauert länger da jedes mal auch die Instructions mitgegeben werden müssen.
 * Die Instructions die dem Assistent schon gegeben wurden, werden überschrieben.
 * Instructions müssen von Nuxt aus mitkommen da die Liste mit erlaubten Tags mitgeschickt wird
 * und es unpraktisch wäre die hier und online in den Instructions synchron zu halten.
 *
 * Es gibt keine Dokumentation zum Thread Limit. Threads werden gerade noch nicht gelöscht
 * da die Delete API etwas hinterher ist und scheinbar nicht immer synchron mit den gerade
 * erstellten Threads... Also manuell:  https://community.openai.com/t/list-and-delete-all-threads/505823/3
 * ungut!
 *
 * Wenn zu einem einzigen Thread umgestellt wird muss eine Queue eingerichtet werden
 * da nur ein Run auf einmal laufen kann. Das wird den ganzen Prozess Wohnungen neu zu laden
 * etwas verlangsamen.
 *
 * Alternative wäre die Tags zu einem anderen Zeitpunkt zu laden wenn das Scrapen fertig ist.
 * Allerdings haben wir da nicht mehr alle Infos über die Wohnung, sondern nur den Titel....
 *
 *
 *
 * NOCH MEHR TODO:
 * API auf Rate Limit und andere Fehler prüfen
 */

const openaiApiKey = env.OPENAI_API_KEY;

let openai: OpenAI | undefined;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
} else {
  console.warn("OpenAI API key is not provided in the env file.");
}

export const getApartmentTagsViaAI = async (
  flatId: string,
  apartmentTitle: string,
) => {
  if (openai === undefined) {
    console.error("OpenAI API key is not provided in the env file.");
    return [];
  }
  const existingFlat = await db.query.flat.findFirst({
    where: eq(flat.id, flatId),
  });
  if (existingFlat) {
    return (
      await db
        .select()
        .from(tag)
        .leftJoin(flatToTag, eq(flatToTag.tagId, tag.id))
        .leftJoin(flat, eq(flat.id, flatToTag.flatId))
        .where(eq(flat.id, flatId))
    ).map((res) => res.tag.id);
  }

  const possibleTags = Object.keys(tags)
    .filter((tag) => tag !== "new")
    .join(", ");

  const run = await openai.beta.threads.createAndRun({
    assistant_id: "asst_1A41Kwq2ETuoNNRD0ZrkBoNM",
    thread: {
      messages: [{ role: "user", content: apartmentTitle }],
    },
    instructions: `Du bist Mitarbeiter eines Wohnungsportals. Deine Aufgabe: Dir werden Wohnungstitel gezeigt, du musst passende Tags aus einer vordefinierten Liste raussuchen, nach denen die Wohnung kategorisiert wird. Bediene dich NUR an den erlaubten Tags! Ordne nur Tags zu wenn es aus dem Titel direkt hervorgeht, erfinde nichts neues dazu!

    Beispiel:
    User: Wohnberechtigungsschein mit besonderen Wohnbedarf erforderlich!
    Ausgabe: WBS
    
    User: Neubau - Erstbezug - Wir wartet auf Sie
    Ausgabe: Neubau, Erstbezug
    
    User: Sanierte Singlewohnung mit Parkett
    Ausgabe: keine
    
    User: Herzlich Willkommen im neuen Zuhause
    Ausgabe: keine
    
    Gebe die Tags, getrennt mit einem Komma aus.
    Das hier sind die möglichen Tags, VERWENDE NUR DIESE: ${possibleTags}`,
  });

  // By default, a Run goes into the queued state. You can periodically retrieve the Run to check on its status to see if it has moved to completed.
  return new Promise<Tags>((resolve) => {
    const intervalId = setInterval(async () => {
      if (openai === undefined) {
        console.error("OpenAI API key is not provided in the env file.");
        return [];
      }
      const fetchedRun = await openai.beta.threads.runs.retrieve(
        run.thread_id,
        run.id,
      );
      console.log(fetchedRun.status);
      if (fetchedRun.status === "completed") {
        // console.log(fetchedRun);
        clearInterval(intervalId);
        const threadMessages = await openai.beta.threads.messages.list(
          fetchedRun.thread_id,
        );

        const data = threadMessages.data;
        const AIanswer =
          data[0].content[0].type === "text"
            ? data[0].content[0].text.value
            : "";
        // console.log("AI: ", AIanswer);

        const tagsArray = AIanswer.split(",").map((item) => {
          return (
            item
              // eslint-disable-next-line quotes
              .replaceAll('"', "") // sometimes AI returns tags in quotes
              .replace("keine", "") // if no Tags, AI will say "keine"
              .toLowerCase()
              .trim()
          );
        });

        const validTags = Object.keys(tags).filter((tag) => tag !== "new");
        const validatedTags: string[] = [];

        for (const tag of tagsArray) {
          if (validTags.includes(tag)) {
            validatedTags.push(tag);
          } else {
            console.warn(
              `Invalid tag "${tag}" removed for Apartment ${apartmentTitle.substring(0, 10)}`,
            );
          }
        }

        const parsedTags: Tags = tagsSchema.parse(validatedTags);

        // try {
        //   await openai.beta.threads.del(fetchedRun.thread_id);
        // } catch (err) {
        //   console.warn(`Thread ${fetchedRun.thread_id} couldn't be deleted`);
        // }

        console.log("Apartment ", apartmentTitle, "got Tags: ", parsedTags);

        resolve(parsedTags);
      }
    }, 400);
  });
};
