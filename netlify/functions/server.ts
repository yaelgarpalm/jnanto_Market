import { app } from "../../src/server";
import serverless from "@netlify/functions";

export const handler = serverless({ app });
