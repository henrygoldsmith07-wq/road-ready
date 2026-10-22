/* Wait until the local static server answers, then warm it.
 *
 * The Lighthouse job used to start the server and sleep for a fixed two
 * seconds before measuring. On a loaded runner that sleep is a race: the
 * first measured request can land while Node is still starting up, and that
 * request pays the process start-up cost. The score then reports the
 * runner's start-up time instead of the app's.
 *
 * A person opening the app never waits for a cold Node process, so the
 * measurement should not either. This waits for the server to answer and
 * makes one warm-up request before the measurement begins.
 */
import { setTimeout as sleep } from "node:timers/promises";

const url = process.argv[2] || "http://localhost:8321/";
const timeoutMs = 60_000;
const deadline = Date.now() + timeoutMs;

for (;;) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      await response.arrayBuffer();
      console.log("server ready:", url);
      break;
    }
  } catch {
    // Not listening yet.
  }
  if (Date.now() > deadline) {
    console.error("server did not answer within " + timeoutMs + "ms:", url);
    process.exit(1);
  }
  await sleep(250);
}
