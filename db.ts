import { createClient, type Client } from '@libsql/client'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'school.db')

let _client: Client | null = null
let _initialized = false

export function getClient(): Client {
  if (_client) return _client
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  _client = createClient({ url: `file:${DB_PATH}` })
  return _client
}

export async function initDb() {
  if (_initialized) return
  _initialized = true
  const db = getClient()

  await db.executeMultiple(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      level TEXT DEFAULT 'A1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      level TEXT DEFAULT 'A1',
      order_number INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'vocabulary',
      term TEXT NOT NULL,
      translation TEXT NOT NULL,
      example_sentence TEXT,
      explanation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_lesson_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      unlocked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lesson_item_id INTEGER NOT NULL REFERENCES lesson_items(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'learning',
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      consecutive_correct INTEGER DEFAULT 0,
      last_practiced_at TEXT,
      UNIQUE(student_id, lesson_item_id)
    );

    CREATE TABLE IF NOT EXISTS student_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      achievement_key TEXT NOT NULL,
      earned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, achievement_key)
    );
  `)

  // Add streak columns to existing students table (safe to run repeatedly)
  try { await db.execute('ALTER TABLE students ADD COLUMN streak INTEGER DEFAULT 0') } catch {}
  try { await db.execute('ALTER TABLE students ADD COLUMN streak_last_date TEXT') } catch {}

  // Migrate admin email to correct address
  await db.execute({ sql: "UPDATE admins SET email = 'eu@teachertaina.com.br' WHERE email = 'taina@teachertaina.com'", args: [] })

  await seedIfEmpty(db)
  await seedLessonsIfEmpty(db)
}

async function seedIfEmpty(db: Client) {
  const count = (await db.execute('SELECT COUNT(*) as c FROM admins')).rows[0]?.c
  if (Number(count) > 0) return

  const adminHash = await bcrypt.hash('taina123', 10)
  await db.execute({ sql: 'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)', args: ['Tainá Dutra', 'eu@teachertaina.com.br', adminHash] })

  const s1Hash = await bcrypt.hash('larissa123', 10)
  const s2Hash = await bcrypt.hash('marina123', 10)
  const s1 = (await db.execute({ sql: 'INSERT INTO students (name, email, password_hash, level) VALUES (?, ?, ?, ?) RETURNING id', args: ['Larissa Oliveira', 'larissa@email.com', s1Hash, 'A2'] })).rows[0]
  const s2 = (await db.execute({ sql: 'INSERT INTO students (name, email, password_hash, level) VALUES (?, ?, ?, ?) RETURNING id', args: ['Marina Santos', 'marina@email.com', s2Hash, 'A2'] })).rows[0]

  const l1 = (await db.execute({ sql: 'INSERT INTO lessons (title, level, order_number, description) VALUES (?, ?, ?, ?) RETURNING id', args: ['Vocabulário de Rotina Diária', 'A2', 1, 'Palavras essenciais para descrever atividades do dia a dia em inglês.'] })).rows[0]
  const l2 = (await db.execute({ sql: 'INSERT INTO lessons (title, level, order_number, description) VALUES (?, ?, ?, ?) RETURNING id', args: ['Present Continuous + Roupas', 'A2', 2, 'Como usar o presente contínuo e vocabulário de roupas e looks.'] })).rows[0]

  for (const [term, translation, example, type] of [
    ['wake up', 'acordar', 'I wake up at 7am every day.', 'vocabulary'],
    ['have breakfast', 'tomar café da manhã', 'She has breakfast before going to work.', 'vocabulary'],
    ['commute', 'ir ao trabalho / deslocamento', 'The commute takes 30 minutes by bus.', 'vocabulary'],
    ['get dressed', 'se vestir', 'I get dressed quickly in the morning.', 'vocabulary'],
    ['brush teeth', 'escovar os dentes', "Don't forget to brush your teeth!", 'vocabulary'],
    ['make coffee', 'fazer café', 'He makes coffee every morning.', 'vocabulary'],
    ['check emails', 'verificar e-mails', 'I check my emails after breakfast.', 'vocabulary'],
    ['go for a walk', 'dar uma caminhada', 'She goes for a walk in the evening.', 'vocabulary'],
    ['cook dinner', 'cozinhar o jantar', 'They cook dinner together on Sundays.', 'vocabulary'],
    ['unwind', 'relaxar / descansar', 'I like to unwind by reading a book.', 'vocabulary'],
    ['get home', 'chegar em casa', 'I get home around 6pm.', 'vocabulary'],
    ['take a shower', 'tomar banho', 'She takes a shower every morning.', 'vocabulary'],
  ] as const) {
    await db.execute({ sql: 'INSERT INTO lesson_items (lesson_id, type, term, translation, example_sentence) VALUES (?, ?, ?, ?, ?)', args: [Number(l1.id), type, term, translation, example] })
  }

  for (const [term, translation, example, type] of [
    ['jacket', 'jaqueta / casaco', "It's cold — bring your jacket!", 'vocabulary'],
    ['blouse', 'blusa', 'I love this floral blouse.', 'vocabulary'],
    ['sneakers', 'tênis', 'She always wears white sneakers.', 'vocabulary'],
    ['outfit', 'look / roupa', 'Your outfit looks amazing today!', 'vocabulary'],
    ['try on', 'experimentar (roupa)', 'Can I try on this dress?', 'vocabulary'],
    ['fit', 'servir (tamanho)', "These jeans don't fit me anymore.", 'vocabulary'],
    ['right now', 'agora mesmo / neste momento', 'What are you doing right now?', 'vocabulary'],
    ['at the moment', 'no momento', 'She is working from home at the moment.', 'vocabulary'],
    ['is wearing', 'está usando / vestindo', 'She is wearing a red dress today.', 'grammar'],
    ['are going', 'estão indo', 'They are going to the mall right now.', 'grammar'],
    ['Present Continuous', 'Presente Contínuo (ação em andamento)', 'I am studying English right now.', 'grammar'],
    ['to be + verb-ing', 'estrutura do Present Continuous', 'He is cooking dinner at the moment.', 'grammar'],
  ] as const) {
    await db.execute({ sql: 'INSERT INTO lesson_items (lesson_id, type, term, translation, example_sentence) VALUES (?, ?, ?, ?, ?)', args: [Number(l2.id), type, term, translation, example] })
  }

  await db.execute({ sql: 'INSERT INTO student_lesson_access (student_id, lesson_id) VALUES (?, ?)', args: [Number(s1.id), Number(l1.id)] })
  await db.execute({ sql: 'INSERT INTO student_lesson_access (student_id, lesson_id) VALUES (?, ?)', args: [Number(s1.id), Number(l2.id)] })
  await db.execute({ sql: 'INSERT INTO student_lesson_access (student_id, lesson_id) VALUES (?, ?)', args: [Number(s2.id), Number(l1.id)] })
}

async function seedLessonsIfEmpty(db: Client) {
  const seedPath = path.join(process.cwd(), 'lib', 'seed-lessons.json')
  if (!fs.existsSync(seedPath)) return

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as {
    lessons: { id: number; title: string; level: string; order_number: number; description: string }[]
    items: { id: number; lesson_id: number; term: string; translation: string; example_sentence: string; type: string }[]
  }

  // Insert each lesson that doesn't exist yet (by title), map seed IDs → production IDs
  const idMap: Record<number, number> = {}
  for (const lesson of seed.lessons) {
    const existing = (await db.execute({
      sql: 'SELECT id FROM lessons WHERE title = ?',
      args: [lesson.title],
    })).rows[0]

    if (existing) {
      idMap[lesson.id] = Number(existing.id)
    } else {
      const row = (await db.execute({
        sql: 'INSERT INTO lessons (title, level, order_number, description) VALUES (?, ?, ?, ?) RETURNING id',
        args: [lesson.title, lesson.level, lesson.order_number, lesson.description],
      })).rows[0]
      idMap[lesson.id] = Number(row.id)

      // Insert items only for newly created lessons
      for (const item of seed.items) {
        if (item.lesson_id !== lesson.id) continue
        await db.execute({
          sql: 'INSERT INTO lesson_items (lesson_id, type, term, translation, example_sentence) VALUES (?, ?, ?, ?, ?)',
          args: [idMap[lesson.id], item.type, item.term, item.translation, item.example_sentence ?? null],
        })
      }
    }
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

async function db() { await initDb(); return getClient() }

export async function getAllLessons() {
  const c = await db()
  return (await c.execute(`SELECT l.*, COUNT(li.id) as item_count FROM lessons l LEFT JOIN lesson_items li ON li.lesson_id = l.id GROUP BY l.id ORDER BY l.order_number, l.id`)).rows
}

export async function getLessonById(id: number) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT * FROM lessons WHERE id = ?', args: [id] })).rows[0] || null
}

export async function getLessonItems(lessonId: number) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT * FROM lesson_items WHERE lesson_id = ? ORDER BY id', args: [lessonId] })).rows
}

export async function getStudentLessons(studentId: number) {
  const c = await db()
  return (await c.execute({ sql: `SELECT l.*, COUNT(li.id) as item_count, sla.unlocked_at FROM student_lesson_access sla JOIN lessons l ON l.id = sla.lesson_id LEFT JOIN lesson_items li ON li.lesson_id = l.id WHERE sla.student_id = ? GROUP BY l.id ORDER BY l.order_number, l.id`, args: [studentId] })).rows
}

export async function getStudentProgress(studentId: number, lessonId: number) {
  const c = await db()
  return (await c.execute({ sql: `SELECT sp.* FROM student_progress sp JOIN lesson_items li ON li.id = sp.lesson_item_id WHERE sp.student_id = ? AND li.lesson_id = ?`, args: [studentId, lessonId] })).rows
}

export async function getStudentProgressAll(studentId: number) {
  const c = await db()
  return (await c.execute({ sql: `SELECT sp.status, li.lesson_id FROM student_progress sp JOIN lesson_items li ON li.id = sp.lesson_item_id WHERE sp.student_id = ?`, args: [studentId] })).rows
}

export async function getStudentAccess(studentId: number) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT lesson_id FROM student_lesson_access WHERE student_id = ?', args: [studentId] })).rows as unknown as { lesson_id: number }[]
}

export async function setStudentAccess(studentId: number, lessonIds: number[]) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM student_lesson_access WHERE student_id = ?', args: [studentId] })
  for (const lid of lessonIds) {
    await c.execute({ sql: 'INSERT INTO student_lesson_access (student_id, lesson_id) VALUES (?, ?)', args: [studentId, lid] })
  }
}

export const ACHIEVEMENTS: Record<string, { key: string; name: string; desc: string; emoji: string; color: string }> = {
  streak_3:   { key: 'streak_3',   name: '3 dias consecutivos',    desc: 'Praticou 3 dias seguidos!',    emoji: '🔥', color: 'bg-red-50 border-red-200 text-red-800' },
  streak_7:   { key: 'streak_7',   name: '1 semana consecutiva',   desc: 'Praticou 7 dias seguidos!',    emoji: '💪', color: 'bg-green-50 border-green-200 text-green-800' },
  streak_15:  { key: 'streak_15',  name: '15 dias consecutivos',   desc: 'Praticou 15 dias seguidos!',   emoji: '🌙', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  streak_30:  { key: 'streak_30',  name: '1 mês consecutivo',      desc: 'Praticou 1 mês seguido!',      emoji: '🏆', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  streak_60:  { key: 'streak_60',  name: '2 meses consecutivos',   desc: 'Praticou 2 meses seguidos!',   emoji: '🌟', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  streak_90:  { key: 'streak_90',  name: '3 meses consecutivos',   desc: 'Praticou 3 meses seguidos!',   emoji: '💎', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  streak_120: { key: 'streak_120', name: '4 meses consecutivos',   desc: 'Praticou 4 meses seguidos!',   emoji: '🚀', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  streak_150: { key: 'streak_150', name: '5 meses consecutivos',   desc: 'Praticou 5 meses seguidos!',   emoji: '🌺', color: 'bg-pink-50 border-pink-200 text-pink-800' },
  streak_180: { key: 'streak_180', name: '6 meses consecutivos',   desc: 'Praticou 6 meses seguidos!',   emoji: '🎯', color: 'bg-teal-50 border-teal-200 text-teal-800' },
  streak_210: { key: 'streak_210', name: '7 meses consecutivos',   desc: 'Praticou 7 meses seguidos!',   emoji: '⚡', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  streak_240: { key: 'streak_240', name: '8 meses consecutivos',   desc: 'Praticou 8 meses seguidos!',   emoji: '🌈', color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
  streak_270: { key: 'streak_270', name: '9 meses consecutivos',   desc: 'Praticou 9 meses seguidos!',   emoji: '✨', color: 'bg-violet-50 border-violet-200 text-violet-800' },
  streak_300: { key: 'streak_300', name: '10 meses consecutivos',  desc: 'Praticou 10 meses seguidos!',  emoji: '🎖️', color: 'bg-lime-50 border-lime-200 text-lime-800' },
  streak_330: { key: 'streak_330', name: '11 meses consecutivos',  desc: 'Praticou 11 meses seguidos!',  emoji: '🌍', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  streak_365: { key: 'streak_365', name: '1 ano consecutivo',      desc: 'Praticou 1 ano inteiro!',      emoji: '👑', color: 'bg-rose-50 border-rose-200 text-rose-800' },
}

export async function recordAnswer(studentId: number, itemId: number, correct: boolean) {
  const c = await db()

  // Load current progress for this item
  const rows = (await c.execute({ sql: 'SELECT * FROM student_progress WHERE student_id = ? AND lesson_item_id = ?', args: [studentId, itemId] })).rows
  if (rows.length === 0) {
    await c.execute({ sql: 'INSERT INTO student_progress (student_id, lesson_item_id) VALUES (?, ?)', args: [studentId, itemId] })
  }
  const progress = rows[0] || { consecutive_correct: 0, correct_count: 0, wrong_count: 0, status: 'learning' }
  const prevStatus = String(progress.status || 'learning')
  const newConsecutive = correct ? Number(progress.consecutive_correct) + 1 : 0
  const newCorrect = correct ? Number(progress.correct_count) + 1 : Number(progress.correct_count)
  const newWrong = correct ? Number(progress.wrong_count) : Number(progress.wrong_count) + 1
  let newStatus = 'learning'
  if (newConsecutive >= 3) newStatus = 'mastered'
  else if (newConsecutive >= 1) newStatus = 'reviewing'
  await c.execute({ sql: `UPDATE student_progress SET status = ?, correct_count = ?, wrong_count = ?, consecutive_correct = ?, last_practiced_at = datetime('now') WHERE student_id = ? AND lesson_item_id = ?`, args: [newStatus, newCorrect, newWrong, newConsecutive, studentId, itemId] })

  const firstMastery = newStatus === 'mastered' && prevStatus !== 'mastered'

  // Update streak
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const sRow = (await c.execute({ sql: 'SELECT streak, streak_last_date FROM students WHERE id = ?', args: [studentId] })).rows[0]
  const lastDate = sRow?.streak_last_date as string | null
  let streak = Number(sRow?.streak || 0)
  if (correct) {
    if (lastDate === today) { /* already counted today */ }
    else if (lastDate === yesterday) { streak += 1 }
    else { streak = 1 }
    await c.execute({ sql: 'UPDATE students SET streak = ?, streak_last_date = ? WHERE id = ?', args: [streak, today, studentId] })
  }

  // Check and unlock achievements
  const newAchievements: string[] = []
  async function tryUnlock(key: string) {
    try {
      await c.execute({ sql: 'INSERT INTO student_achievements (student_id, achievement_key) VALUES (?, ?)', args: [studentId, key] })
      newAchievements.push(key)
    } catch { /* already unlocked (UNIQUE constraint) */ }
  }

  if (correct) {
    if (streak >= 3)   await tryUnlock('streak_3')
    if (streak >= 7)   await tryUnlock('streak_7')
    if (streak >= 15)  await tryUnlock('streak_15')
    if (streak >= 30)  await tryUnlock('streak_30')
    if (streak >= 60)  await tryUnlock('streak_60')
    if (streak >= 90)  await tryUnlock('streak_90')
    if (streak >= 120) await tryUnlock('streak_120')
    if (streak >= 150) await tryUnlock('streak_150')
    if (streak >= 180) await tryUnlock('streak_180')
    if (streak >= 210) await tryUnlock('streak_210')
    if (streak >= 240) await tryUnlock('streak_240')
    if (streak >= 270) await tryUnlock('streak_270')
    if (streak >= 300) await tryUnlock('streak_300')
    if (streak >= 330) await tryUnlock('streak_330')
    if (streak >= 365) await tryUnlock('streak_365')
  }

  return { status: newStatus, consecutive_correct: newConsecutive, firstMastery, newAchievements, streak }
}

export async function getAllStudents() {
  const c = await db()
  return (await c.execute('SELECT id, name, email, level, created_at FROM students ORDER BY name')).rows
}

export async function getStudentById(id: number) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT id, name, email, level, created_at FROM students WHERE id = ?', args: [id] })).rows[0] || null
}

export async function getAdminByEmail(email: string) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT * FROM admins WHERE email = ?', args: [email] })).rows[0] || null
}

export async function getStudentByEmail(email: string) {
  const c = await db()
  return (await c.execute({ sql: 'SELECT * FROM students WHERE email = ?', args: [email] })).rows[0] || null
}

export async function createStudent(name: string, email: string, passwordHash: string, level: string) {
  const c = await db()
  return (await c.execute({ sql: 'INSERT INTO students (name, email, password_hash, level) VALUES (?, ?, ?, ?) RETURNING *', args: [name, email, passwordHash, level] })).rows[0]
}

export async function updateStudent(id: number, name: string, email: string, level: string) {
  const c = await db()
  await c.execute({ sql: 'UPDATE students SET name = ?, email = ?, level = ? WHERE id = ?', args: [name, email, level, id] })
}

export async function updateStudentPassword(id: number, passwordHash: string) {
  const c = await db()
  await c.execute({ sql: 'UPDATE students SET password_hash = ? WHERE id = ?', args: [passwordHash, id] })
}

export async function deleteStudent(id: number) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM students WHERE id = ?', args: [id] })
}

export async function createLesson(title: string, level: string, order: number, description: string) {
  const c = await db()
  return (await c.execute({ sql: 'INSERT INTO lessons (title, level, order_number, description) VALUES (?, ?, ?, ?) RETURNING *', args: [title, level, order, description] })).rows[0]
}

export async function updateLesson(id: number, title: string, level: string, order: number, description: string) {
  const c = await db()
  await c.execute({ sql: 'UPDATE lessons SET title = ?, level = ?, order_number = ?, description = ? WHERE id = ?', args: [title, level, order, description, id] })
}

export async function deleteLesson(id: number) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM lessons WHERE id = ?', args: [id] })
}

export async function getStudentStats(studentId: number) {
  const c = await db()
  const sRow = (await c.execute({ sql: 'SELECT streak, streak_last_date FROM students WHERE id = ?', args: [studentId] })).rows[0]
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const lastDate = sRow?.streak_last_date as string | null
  const streak = (lastDate === today || lastDate === yesterday) ? Number(sRow?.streak || 0) : 0
  const achRows = (await c.execute({ sql: 'SELECT achievement_key, earned_at FROM student_achievements WHERE student_id = ? ORDER BY earned_at', args: [studentId] })).rows
  return { streak, achievements: achRows.map(r => ({ key: String(r.achievement_key), earned_at: String(r.earned_at) })) }
}

export async function createLessonItem(lessonId: number, type: string, term: string, translation: string, example: string, explanation: string) {
  const c = await db()
  return (await c.execute({ sql: 'INSERT INTO lesson_items (lesson_id, type, term, translation, example_sentence, explanation) VALUES (?, ?, ?, ?, ?, ?) RETURNING *', args: [lessonId, type, term, translation, example, explanation] })).rows[0]
}

export async function updateLessonItem(id: number, type: string, term: string, translation: string, example: string, explanation: string) {
  const c = await db()
  await c.execute({ sql: 'UPDATE lesson_items SET type = ?, term = ?, translation = ?, example_sentence = ?, explanation = ? WHERE id = ?', args: [type, term, translation, example, explanation, id] })
}

export async function deleteLessonItem(id: number) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM lesson_items WHERE id = ?', args: [id] })
}

export async function getFullStudentProgress(studentId: number) {
  const c = await db()
  return (await c.execute({ sql: `SELECT sp.*, li.term, li.translation, li.type, l.title as lesson_title, l.id as lesson_id FROM student_progress sp JOIN lesson_items li ON li.id = sp.lesson_item_id JOIN lessons l ON l.id = li.lesson_id WHERE sp.student_id = ? ORDER BY l.order_number, l.id, li.id`, args: [studentId] })).rows
}

export async function getAdminStats() {
  const c = await db()
  const students = Number((await c.execute('SELECT COUNT(*) as c FROM students')).rows[0]?.c || 0)
  const lessons = Number((await c.execute('SELECT COUNT(*) as c FROM lessons')).rows[0]?.c || 0)
  const items = Number((await c.execute('SELECT COUNT(*) as c FROM lesson_items')).rows[0]?.c || 0)
  const mastered = Number((await c.execute("SELECT COUNT(*) as c FROM student_progress WHERE status = 'mastered'")).rows[0]?.c || 0)
  return { students, lessons, items, mastered }
}
