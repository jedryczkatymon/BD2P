import { librarianRouter } from "~/server/api/routers/librarian";
import { userRouter } from "~/server/api/routers/user";
import { workRouter } from "~/server/api/routers/work";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	librarian: librarianRouter,
	user: userRouter,
	work: workRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.work.list({ page: 1, pageSize: 50 });
 *       ^? { items, total, page, pageSize }
 */
export const createCaller = createCallerFactory(appRouter);
