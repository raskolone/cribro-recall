import type express from 'express';
import {
  HandlerResult,
  HomeworkSeriesHandlerDeps,
  SeriesDb,
  handleCreateSeries,
  handleCronRelease,
  handleDeleteSeries,
  handleGetSeries,
  handleListSeries,
  handleReleaseNow,
  verifyCronSecret,
} from './homeworkSeriesHandler';

export interface HomeworkSeriesRouteDeps {
  /** `requireFirebaseAdmin` z server.ts — ustawia `req.adminUid`. */
  requireTeacher: express.RequestHandler;
  /** Leniwie: cron z błędnym sekretem nie ma nawet dotknąć bazy. */
  getDb: () => SeriesDb;
  getCronSecret: () => string | undefined;
  now?: () => Date;
}

const CRON_PATH = '/api/homework-series/cron-release';

/**
 * Trasy serii prac domowych.
 *
 * KOLEJNOŚĆ MA ZNACZENIE: Express dopasowuje trasy w kolejności rejestracji, więc
 * `GET /api/homework-series/:id` zarejestrowane wcześniej przechwyciłoby
 * `GET …/cron-release` (Vercel Cron wywołuje GET) i odbiłoby je w
 * `requireFirebaseAdmin`, bo `Bearer <CRON_SECRET>` nie jest tokenem Firebase.
 * Dlatego trasy crona idą jako pierwsze — pilnuje tego
 * tests/homeworkSeriesCronRoute.test.ts na prawdziwym routerze Expressa.
 */
export function registerHomeworkSeriesRoutes(app: express.Express, deps: HomeworkSeriesRouteDeps): void {
  const handlerDeps = (req?: express.Request): HomeworkSeriesHandlerDeps => ({
    db: deps.getDb(),
    now: deps.now,
    cronSecret: deps.getCronSecret(),
    origin: req && typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
  });

  const send = (res: express.Response, result: HandlerResult) => res.status(result.status).json(result.body);

  const teacherRoute =
    (label: string, run: (req: express.Request) => Promise<HandlerResult>): express.RequestHandler =>
    async (req, res) => {
      try {
        send(res, await run(req));
      } catch (err: any) {
        console.error(`[homework-series] ${label}:`, err);
        res.status(500).json({ error: err?.message || 'Internal server error' });
      }
    };

  // 1. Cron (Vercel Cron wywołuje GET z `Authorization: Bearer <CRON_SECRET>`; dopuszczamy też POST).
  const cronReleaseHandler: express.RequestHandler = async (req, res) => {
    try {
      const secretCheck = verifyCronSecret(req.headers.authorization, deps.getCronSecret());
      if (!secretCheck.ok) {
        return res.status(secretCheck.status).json({ error: secretCheck.error });
      }
      send(res, await handleCronRelease(handlerDeps(), { authHeader: req.headers.authorization }));
    } catch (err: any) {
      console.error('[homework-series] Błąd w cronReleaseHandler:', err);
      res.status(500).json({ error: err?.message || 'Cron execution failed' });
    }
  };
  app.get(CRON_PATH, cronReleaseHandler);
  app.post(CRON_PATH, cronReleaseHandler);

  // 2. Trasy lektora.
  app.post(
    '/api/homework-series',
    deps.requireTeacher,
    teacherRoute('Błąd tworzenia serii', (req) =>
      handleCreateSeries(handlerDeps(req), { callerUid: (req as any).adminUid, body: req.body })
    )
  );

  app.get(
    '/api/homework-series',
    deps.requireTeacher,
    teacherRoute('Błąd pobierania listy serii', (req) =>
      handleListSeries(handlerDeps(req), {
        callerUid: (req as any).adminUid,
        studentUid: typeof req.query.studentUid === 'string' ? req.query.studentUid : undefined,
      })
    )
  );

  app.get(
    '/api/homework-series/:id',
    deps.requireTeacher,
    teacherRoute('Błąd pobierania serii', (req) =>
      handleGetSeries(handlerDeps(req), { callerUid: (req as any).adminUid, seriesId: String(req.params.id) })
    )
  );

  app.delete(
    '/api/homework-series/:id',
    deps.requireTeacher,
    teacherRoute('Błąd usuwania serii', (req) =>
      handleDeleteSeries(handlerDeps(req), { callerUid: (req as any).adminUid, seriesId: String(req.params.id) })
    )
  );

  // Ręczne natychmiastowe wydanie gotowej pozycji przez lektora.
  app.post(
    '/api/homework-series/:id/release-now',
    deps.requireTeacher,
    teacherRoute('Błąd ręcznego wydania serii', (req) =>
      handleReleaseNow(handlerDeps(req), {
        callerUid: (req as any).adminUid,
        seriesId: String(req.params.id),
        itemId: req.body?.itemId,
      })
    )
  );
}
