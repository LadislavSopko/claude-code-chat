import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { admin } from "better-auth/plugins/admin";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { Config } from "../common/config";

export async function isEmailWhitelisted(
  db: Db,
  email: string,
  adminEmail: string,
): Promise<boolean> {
  if (email === adminEmail) return true;
  const [found] = await db
    .select()
    .from(schema.whitelistedEmails)
    .where(eq(schema.whitelistedEmails.email, email));
  return !!found;
}

export function createAuth(db: Db, config: Config) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    socialProviders: {
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [bearer(), admin()],
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = user.email;
            if (!(await isEmailWhitelisted(db, email, config.ADMIN_EMAIL))) {
              return false;
            }
            const role = email === config.ADMIN_EMAIL ? "admin" : "user";
            return { data: { ...user, role } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
