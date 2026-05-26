import { app } from "../../src/server";
import { handler as netlifyHandler } from "@netlify/functions";

export const handler = netlifyHandler({ app });

