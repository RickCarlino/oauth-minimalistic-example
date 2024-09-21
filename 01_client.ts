// client.ts
import express, { Request, Response } from "express";
import axios from "axios";
import { URLSearchParams } from "url";

const app = express();
const port = 4000;

const clientId = "abc123";
const clientSecret = "sooper-secret";
const redirectUri = "http://localhost:4000/callback";
const stateStore: { [key: string]: boolean } = {};

app.get("/", (_req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(7);
  // Store the state for later verification
  stateStore[state] = true;

  const authUrl = `http://localhost:3000/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  res.send(`<a href="${authUrl}">Login with OAuth Provider</a>`);
});

app.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  // Verify code and state are strings
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing code or state in query parameters");
  }

  // Verify state parameter
  if (!stateStore[state]) {
    return res.status(400).send("Invalid state parameter");
  }

  // Exchange authorization code for access token
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  try {
    const tokenResponse = await axios.post<{ access_token: string }>(
      "http://localhost:3000/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Access protected resource
    const resourceResponse = await axios.get("http://localhost:3000/resource", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.send(resourceResponse.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

app.listen(port, () => {
  console.log(`Client app listening at http://localhost:${port}`);
});
