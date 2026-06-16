// Read-path check: verifies the THREAD_COLUMNS embed (author + post_count) and
// the postCount-only-counts-live-posts behavior the listThreads query relies on.
import { readFileSync } from 'node:fs'
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = class { constructor(){ throw new Error('x') } }
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('.env.local','utf8').split('\n')) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const URL=env.NEXT_PUBLIC_SUPABASE_URL, ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE=env.SUPABASE_SERVICE_ROLE_KEY
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}})

let pass=0, fail=0
const ok=(l)=>{pass++;console.log('PASS:',l)}
const bad=(l,d)=>{fail++;console.log('FAIL:',l,'::',d)}

async function makeUser(tag){
  const email=`readchk+${tag}-${Date.now()}-${Math.floor(Math.random()*1e6)}@example.com`, password='password123'
  const {data}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:`rc_${tag}_${Math.floor(Math.random()*1e6)}`}})
  const client=createClient(URL,ANON,{auth:{persistSession:false}})
  await client.auth.signInWithPassword({email,password})
  return {client,userId:data.user.id}
}

const THREAD_COLUMNS='id, category_id, user_id, title, slug, is_pinned, is_locked, show_id, created_at, last_activity_at, author:profiles ( username, display_name, avatar_url ), post_count:forum_posts ( count )'

const A=await makeUser('a')
// thread + 3 posts, then soft-delete 1 -> postCount should be 2 (live only).
const {data:th}=await A.client.from('forum_threads').insert({category_id:'cat-general',user_id:A.userId,title:'Read check thread',slug:'read-check-thread'}).select('id').single()
await A.client.from('forum_posts').insert({thread_id:th.id,user_id:A.userId,body:'p1'})
const {data:p2}=await A.client.from('forum_posts').insert({thread_id:th.id,user_id:A.userId,body:'p2'}).select('id').single()
await A.client.from('forum_posts').insert({thread_id:th.id,user_id:A.userId,body:'p3'})
await A.client.from('forum_posts').update({is_deleted:true,body:''}).eq('id',p2.id)

const anon=createClient(URL,ANON,{auth:{persistSession:false}})
// Mirror listThreads(): embed filter post_count.is_deleted=false.
const {data,error}=await anon.from('forum_threads').select(THREAD_COLUMNS).eq('post_count.is_deleted',false).eq('category_id','cat-general').eq('id',th.id).maybeSingle()
if(error) bad('listThreads embed query',error.message)
else {
  const count=data?.post_count?.[0]?.count
  if(count===2) ok(`postCount counts only live posts (3 posts, 1 deleted -> ${count})`)
  else bad('live postCount',`expected 2 got ${count} (raw: ${JSON.stringify(data?.post_count)})`)
  if(data?.author) ok('author embed present on thread row')
  else bad('author embed','missing')
}

// getThread() posts oldest-first incl. deleted (blanked in mapper).
const {data:posts}=await anon.from('forum_posts').select('id, body, is_deleted, created_at').eq('thread_id',th.id).order('created_at',{ascending:true})
if(posts?.length===3) ok(`getThread posts returns all 3 (incl. soft-deleted; mapper blanks body)`)
else bad('getThread posts',`expected 3 got ${posts?.length}`)

await admin.from('forum_threads').delete().eq('id',th.id)
await admin.auth.admin.deleteUser(A.userId)
console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail===0?0:1)
