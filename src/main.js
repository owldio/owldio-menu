import { mountAdmin } from "./admin.js";
import { parseAppLocation } from "./domain/routing.js";
import { isBackendConfigured, supabase } from "./lib/supabase.js";
import { mountReader } from "./reader.js";
import { ProgrammeRepository } from "./services/programme-repository.js";

const route = parseAppLocation(window.location.pathname, window.location.hash);
const readerRoot = document.querySelector("#reader-shell");
const adminRoot = document.querySelector("#admin-app");

if (route.kind === "admin") {
  document.querySelector(".skip-link").setAttribute("href", "#admin-main");
  readerRoot.hidden = true;
  await mountAdmin({ root: adminRoot, client: isBackendConfigured ? supabase : null });
} else {
  adminRoot.hidden = true;
  const repository = isBackendConfigured ? new ProgrammeRepository(supabase) : null;
  await mountReader({ root: readerRoot, repository, initialRoute: route });
}
