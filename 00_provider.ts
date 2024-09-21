// oauthProvider.ts
import express, { Request, Response } from "express";
import { URL } from "url";

interface Client {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}

interface User {
  username: string;
  password: string;
}

interface AuthorizationCode {
  clientId: string;
  redirectUri: string;
  username: string;
}

interface AccessToken {
  clientId: string;
  username: string;
}

const app = express();
const port = 3000;

// In-memory storage
const clients: Client[] = [
  {
    clientId: "abc123",
    clientSecret: "sooper-secret",
    redirectUris: ["http://localhost:4000/callback"],
  },
];

const users: User[] = [
  {
    username: "alice",
    password: "password123",
  },
];

let authorizationCodes: { [code: string]: AuthorizationCode } = {};
let accessTokens: { [token: string]: AccessToken } = {};

// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log(`OAuth 2.0 provider listening at http://localhost:${port}`);
});

// Authorization endpoint
app.get("/authorize", (req: Request, res: Response) => {
  const client_id = req.query.client_id as string;
  const redirect_uri = req.query.redirect_uri as string;
  const response_type = req.query.response_type as string;
  const state = req.query.state as string | undefined;

  const client = clients.find((c) => c.clientId === client_id);

  if (!client) {
    console.log("Missing client");
    return res.status(400).send("Missing client");
  }

  if (!client.redirectUris.includes(redirect_uri)) {
    console.log("Invalid redirect URI");
    return res.status(400).send("Invalid client or redirect URI");
  }

  // Display a simple login form
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${client_id}" />
      <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
      <input type="hidden" name="response_type" value="${response_type}" />
      <input type="hidden" name="state" value="${state || ""}" />
      <label>Username: <input type="text" name="username" /></label><br />
      <label>Password: <input type="password" name="password" /></label><br />
      <button type="submit">Authorize</button>
    </form>
  `);
});

app.post("/authorize", (req: Request, res: Response) => {
  const { client_id, redirect_uri, response_type, state, username, password } =
    req.body;

  const client = clients.find((c) => c.clientId === client_id);
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!client || !client.redirectUris.includes(redirect_uri) || !user) {
    return res
      .status(400)
      .send("Invalid client, redirect URI, or user credentials");
  }

  if (response_type !== "code") {
    return res.status(400).send("Unsupported response type");
  }

  // Generate authorization code
  const code = Math.random().toString(36).substring(2, 15);
  authorizationCodes[code] = {
    clientId: client_id,
    redirectUri: redirect_uri,
    username,
  };

  // Redirect back to the client with the authorization code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.append("code", code);
  if (state) redirectUrl.searchParams.append("state", state);

  res.redirect(redirectUrl.toString());
});

// Token endpoint
app.post("/token", (req: Request, res: Response) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

  if (grant_type !== "authorization_code") {
    return res.status(400).send("Unsupported grant type");
  }

  const client = clients.find(
    (c) => c.clientId === client_id && c.clientSecret === client_secret
  );
  const authCode = authorizationCodes[code];

  if (
    !client ||
    !authCode ||
    authCode.clientId !== client_id ||
    authCode.redirectUri !== redirect_uri
  ) {
    return res
      .status(400)
      .send("Invalid client credentials or authorization code");
  }

  // Generate access token
  const token = Math.random().toString(36).substring(2, 15);
  accessTokens[token] = { clientId: client_id, username: authCode.username };

  // Remove used authorization code
  delete authorizationCodes[code];

  res.json({
    access_token: token,
    token_type: "Bearer",
  });
});

// Protected resource endpoint
app.get("/resource", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenData = accessTokens[token];

  if (!tokenData) {
    return res.status(401).send("Invalid access token");
  }

  res.json({
    message: `Hello, ${tokenData.username}! This is your protected resource.`,
  });
});
