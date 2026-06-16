-- Seed data for the anime streaming catalog.
-- Generated from the Jikan API (MyAnimeList) by scripts/build_seed.mjs.
-- Idempotent: truncates then inserts. Safe to re-run against a live DB.
-- dubEpisodes are synthesized; episode lists are synthesized; everything
-- else (titles, synopses, cover URLs, genres, sub counts) is real Jikan data.

begin;

truncate table public.airing_slots, public.episodes, public.show_genres, public.shows, public.genres restart identity cascade;

-- genres -------------------------------------------------------------------
insert into public.genres (id, name, slug) values
  ('gen-001', 'Adventure', 'adventure'),
  ('gen-002', 'Award Winning', 'award-winning'),
  ('gen-003', 'Drama', 'drama'),
  ('gen-004', 'Fantasy', 'fantasy'),
  ('gen-005', 'Action', 'action'),
  ('gen-006', 'Mystery', 'mystery'),
  ('gen-007', 'Supernatural', 'supernatural'),
  ('gen-008', 'Sci-Fi', 'sci-fi'),
  ('gen-009', 'Suspense', 'suspense'),
  ('gen-010', 'Comedy', 'comedy'),
  ('gen-011', 'Romance', 'romance'),
('gen-012', 'Slice of Life', 'slice-of-life');

-- shows --------------------------------------------------------------------
insert into public.shows
  (id, slug, title, cover_image, banner_image, synopsis, sub_episodes, dub_episodes, status, year, popularity_score, updated_at)
values
  ('show-001', 'frieren-beyond-journeys-end', 'Frieren: Beyond Journey''s End', 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg', NULL, 'During their decade-long quest to defeat the Demon King, the members of the hero''s party—Himmel himself, the priest Heiter, the dwarf warrior Eisen, and the elven mage Frieren—forge bonds through adventures and battles, creating unforgettable precious memories for most of them.

However, the time that Frieren spends with her comrades is equivalent to merely a fraction of her life, which has lasted over a thousand years. When the party disbands after their victory, Frieren casually returns to her "usual" routine of collecting spells across the continent. Due to her different sense of time, she seemingly holds no strong feelings toward the experiences she went through.

As the years pass, Frieren gradually realizes how her days in the hero''s party truly impacted her. Witnessing the deaths of two of her former companions, Frieren begins to regret having taken their presence for granted; she vows to better understand humans and create real personal connections. Although the story of that once memorable journey has long ended, a new tale is about to begin.

[Written by MAL Rewrite]', 28, 19, 'finished', 2023, 1458270, '2026-06-09T12:00:00.000Z'),
  ('show-002', 'steel-ball-run-jojos-bizarre-adventure', 'Steel Ball Run: JoJo''s Bizarre Adventure', 'https://cdn.myanimelist.net/images/anime/1448/154111l.jpg', NULL, 'In the American Old West, the world''s greatest race is about to begin. Thousands line up in San Diego to travel over six thousand kilometers for a chance to win the grand prize of fifty million dollars. With the era of the horse reaching its end, contestants are allowed to use any kind of vehicle they wish. Competitors will have to endure grueling conditions, traveling up to a hundred kilometers a day through uncharted wastelands. The Steel Ball Run is truly a one-of-a-kind event.

The youthful Johnny Joestar, a crippled former horse racer, has come to San Diego to watch the start of the race. There he encounters Gyro Zeppeli, a racer with two steel balls at his waist instead of a gun. Johnny witnesses Gyro using one of his steel balls to unleash a fantastical power, compelling a man to fire his gun at himself during a duel. In the midst of the action, Johnny happens to touch the steel ball and feels a power surging through his legs, allowing him to stand up for the first time in two years. Vowing to find the secret of the steel balls, Johnny decides to compete in the race, and so begins his bizarre adventure across America on the Steel Ball Run.

[Written by MAL Rewrite]', 12, 0, 'airing', 2026, 212973, '2026-06-14T12:00:00.000Z'),
  ('show-003', 'fullmetal-alchemist-brotherhood', 'Fullmetal Alchemist: Brotherhood', 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg', NULL, 'After a horrific alchemy experiment goes wrong in the Elric household, brothers Edward and Alphonse are left in a catastrophic new reality. Ignoring the alchemical principle banning human transmutation, the boys attempted to bring their recently deceased mother back to life. Instead, they suffered brutal personal loss: Alphonse''s body disintegrated while Edward lost a leg and then sacrificed an arm to keep Alphonse''s soul in the physical realm by binding it to a hulking suit of armor.

The brothers are rescued by their neighbor Pinako Rockbell and her granddaughter Winry. Known as a bio-mechanical engineering prodigy, Winry creates prosthetic limbs for Edward by utilizing "automail," a tough, versatile metal used in robots and combat armor. After years of training, the Elric brothers set off on a quest to restore their bodies by locating the Philosopher''s Stone—a powerful gem that allows an alchemist to defy the traditional laws of Equivalent Exchange.

As Edward becomes an infamous alchemist and gains the nickname "Fullmetal," the boys'' journey embroils them in a growing conspiracy that threatens the fate of the world.

[Written by MAL Rewrite]', 64, 64, 'finished', 2009, 3697344, '2026-05-19T12:00:00.000Z'),
  ('show-004', 'chainsaw-man-the-movie-reze-arc', 'Chainsaw Man – The Movie: Reze Arc', 'https://cdn.myanimelist.net/images/anime/1763/150638l.jpg', NULL, 'Despite the immediate challenges following becoming a devil hunter with the Public Safety Bureau, Denji has quickly adapted to his new life and responsibilities. As the chaos of Denji''s first ordeal with Public Safety settles down, the elite devil hunter Makima decides to take Denji out on a date. Although the date strengthens his affection for Makima and he swears to not fall in love with anyone else, Denji soon finds himself in a tricky situation when he meets a seemingly innocent cafe worker named Reze.

With her forward and flirty demeanor, Reze immediately captures Denji''s heart, driving him to frequent the cafe where she works and deepen his relationship with her. However, Denji is completely oblivious to the fact that meeting Reze might have grave consequences beyond simply deciding which woman his heart belongs to. 

[Written by MAL Rewrite]', 1, 0, 'finished', 2025, 496946, '2026-05-31T12:00:00.000Z'),
  ('show-005', 'steins-gate', 'Steins;Gate', 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg', NULL, 'Eccentric scientist Rintarou Okabe has a never-ending thirst for scientific exploration. Together with his ditzy but well-meaning friend Mayuri Shiina and his roommate Itaru Hashida, Okabe founds the Future Gadget Laboratory in the hopes of creating technological innovations that baffle the human psyche. Despite claims of grandeur, the only notable "gadget" the trio have created is a microwave that has the mystifying power to turn bananas into green goo.

However, when Okabe attends a conference on time travel, he experiences a series of strange events that lead him to believe that there is more to the "Phone Microwave" gadget than meets the eye. Apparently able to send text messages into the past using the microwave, Okabe dabbles further with the "time machine," attracting the ire and attention of the mysterious organization SERN.

Due to the novel discovery, Okabe and his friends find themselves in an ever-present danger. As he works to mitigate the damage his invention has caused to the timeline, Okabe fights a battle to not only save his loved ones but also to preserve his degrading sanity.

[Written by MAL Rewrite]', 24, 24, 'finished', 2011, 2823401, '2026-06-08T12:00:00.000Z'),
  ('show-006', 'attack-on-titan-season-3-part-2', 'Attack on Titan Season 3 Part 2', 'https://cdn.myanimelist.net/images/anime/1517/100633l.jpg', NULL, 'Seeking to restore humanity''s diminishing hope, the Survey Corps embark on a mission to retake Wall Maria, where the battle against the merciless "Titans" takes the stage once again.

Returning to the tattered Shiganshina District that was once his home, Eren Yeager and the Corps find the town oddly unoccupied by Titans. Even after the outer gate is plugged, they strangely encounter no opposition. The mission progresses smoothly until Armin Arlert, highly suspicious of the enemy''s absence, discovers distressing signs of a potential scheme against them. 

Shingeki no Kyojin Season 3 Part 2 follows Eren as he vows to take back everything that was once his. Alongside him, the Survey Corps strive—through countless sacrifices—to carve a path towards victory and uncover the secrets locked away in the Yeager family''s basement.

[Written by MAL Rewrite]', 10, 10, 'finished', 2019, 2605771, '2026-06-12T12:00:00.000Z'),
  ('show-007', 'gintama-season-4', 'Gintama Season 4', 'https://cdn.myanimelist.net/images/anime/3/72078l.jpg', NULL, 'Gintoki, Shinpachi, and Kagura return as the fun-loving but broke members of the Yorozuya team! Living in an alternate-reality Edo, where swords are prohibited and alien overlords have conquered Japan, they try to thrive on doing whatever work they can get their hands on. However, Shinpachi and Kagura still haven''t been paid... Does Gin-chan really spend all that cash playing pachinko?

Meanwhile, when Gintoki drunkenly staggers home one night, an alien spaceship crashes nearby. A fatally injured crew member emerges from the ship and gives Gintoki a strange, clock-shaped device, warning him that it is incredibly powerful and must be safeguarded. Mistaking it for his alarm clock, Gintoki proceeds to smash the device the next morning and suddenly discovers that the world outside his apartment has come to a standstill. With Kagura and Shinpachi at his side, he sets off to get the device fixed; though, as usual, nothing is ever that simple for the Yorozuya team.

Filled with tongue-in-cheek humor and moments of heartfelt emotion, Gintama''s fourth season finds Gintoki and his friends facing both their most hilarious misadventures and most dangerous crises yet.

[Written by MAL Rewrite]', 51, 51, 'finished', 2015, 694044, '2026-06-03T12:00:00.000Z'),
  ('show-008', 'gintama-the-very-final', 'Gintama: The Very Final', 'https://cdn.myanimelist.net/images/anime/1245/116760l.jpg', NULL, 'Two years have passed following the Tendoshuu''s invasion of the O-Edo Central Terminal. Since then, the Yorozuya have gone their separate ways. Foreseeing Utsuro''s return, Gintoki Sakata begins surveying Earth''s ley lines for traces of the other man''s Altana. After an encounter with the remnants of the Tendoshuu—who continue to press on in search of immortality—Gintoki returns to Edo.

Later, the regrouped Shinsengumi and Yorozuya begin an attack on the occupied Central Terminal. With the Altana harvested by the wreckage of the Tendoshuu''s ship in danger of detonating, the Yorozuya and their allies fight their enemies while the safety of Edo—and the rest of the world—hangs in the balance. Fulfilling the wishes of their teacher, Shouyou Yoshida''s former students unite and relive their pasts one final time in an attempt to save their futures.

[Written by MAL Rewrite]', 1, 1, 'finished', 2021, 185315, '2026-06-04T12:00:00.000Z'),
  ('show-009', 'rezero-starting-life-in-another-world-season-4', 'Re:ZERO -Starting Life in Another World- Season 4', 'https://cdn.myanimelist.net/images/anime/1540/155824l.jpg', NULL, 'In the deadly battle at the Watergate City of Priestella, Subaru and his allies barely emerged victorious—but their triumph came at a great cost. Through the "Authority of Gluttony," Rem was put into suspended animation, while Crusch''s memories and even Julius’s name were devoured. As he searches for a way to save them, Subaru learns of the "Sage" Shaula—an all-seeing being said to possess every form of knowledge. His next destination is the Pleiades Watchtower, home to the Sage, the farthest tower standing in the vast, uncharted desert known as the Auguria Dunes—a place so perilous that even the mightiest "Sword Saint," Reinhard, failed to conquer it. The fury of nature, unknown magical beasts, and unimaginable dangers lie ahead. Together with his friends, Subaru embarks on a life-risking journey to reclaim what was lost.

(Source: Kadokawa, edited)', 19, 6, 'airing', 2026, 250862, '2026-06-15T12:00:00.000Z'),
  ('show-010', 'hunter-x-hunter', 'Hunter x Hunter', 'https://cdn.myanimelist.net/images/anime/1337/99013l.jpg', NULL, 'Hunters devote themselves to accomplishing hazardous tasks, all from traversing the world''s uncharted territories to locating rare items and monsters. Before becoming a Hunter, one must pass the Hunter Examination—a high-risk selection process in which most applicants end up handicapped or worse, deceased.

Ambitious participants who challenge the notorious exam carry their own reason. What drives 12-year-old Gon Freecss is finding Ging, his father and a Hunter himself. Believing that he will meet his father by becoming a Hunter, Gon takes the first step to walk the same path.

During the Hunter Examination, Gon befriends the medical student Leorio Paladiknight, the vindictive Kurapika, and ex-assassin Killua Zoldyck. While their motives vastly differ from each other, they band together for a common goal and begin to venture into a perilous world.

[Written by MAL Rewrite]', 148, 148, 'finished', 2011, 3202930, '2026-05-29T12:00:00.000Z'),
  ('show-011', 'gintama-season-2', 'Gintama Season 2', 'https://cdn.myanimelist.net/images/anime/4/50361l.jpg', NULL, 'After a one-year hiatus, Shinpachi Shimura returns to Edo, only to stumble upon a shocking surprise: Gintoki and Kagura, his fellow Yorozuya members, have become completely different characters! Fleeing from the Yorozuya headquarters in confusion, Shinpachi finds that all the denizens of Edo have undergone impossibly extreme changes, in both appearance and personality. Most unbelievably, his sister Otae has married the Shinsengumi chief and shameless stalker Isao Kondou and is pregnant with their first child.

Bewildered, Shinpachi agrees to join the Shinsengumi at Otae and Kondou''s request and finds even more startling transformations afoot both in and out of the ranks of the the organization. However, discovering that Vice Chief Toushirou Hijikata has remained unchanged, Shinpachi and his unlikely Shinsengumi ally set out to return the city of Edo to how they remember it.

With even more dirty jokes, tongue-in-cheek parodies, and shameless references, Gintama'' follows the Yorozuya team through more of their misadventures in the vibrant, alien-filled world of Edo.

[Written by MAL Rewrite]', 51, 51, 'finished', 2011, 616631, '2026-05-22T12:00:00.000Z'),
  ('show-012', 'gintama-enchousen', 'Gintama: Enchousen', 'https://cdn.myanimelist.net/images/anime/1452/123686l.jpg', NULL, 'While Gintoki Sakata was away, the Yorozuya found themselves a new leader: Kintoki, Gintoki''s golden-haired doppelganger. In order to regain his former position, Gintoki will need the help of those around him, a troubling feat when no one can remember him! Between Kintoki and Gintoki, who will claim the throne as the main character?

In addition, Yorozuya make a trip back down to red-light district of Yoshiwara to aid an elderly courtesan in her search for her long-lost lover. Although the district is no longer in chains beneath the earth''s surface, the trio soon learn of the tragic backstories of Yoshiwara''s inhabitants that still haunt them. With flashback after flashback, this quest has Yorozuya witnessing everlasting love and protecting it as best they can with their hearts and souls.

[Written by MAL Rewrite]', 13, 13, 'finished', 2012, 359435, '2026-05-17T12:00:00.000Z'),
  ('show-013', 'legend-of-the-galactic-heroes', 'Legend of the Galactic Heroes', 'https://cdn.myanimelist.net/images/anime/1976/142016l.jpg', NULL, 'The 150-year-long stalemate between the two interstellar superpowers, the Galactic Empire and the Free Planets Alliance, comes to an end when a new generation of leaders arises: the idealistic military genius Reinhard von Lohengramm, and the FPA''s reserved historian, Yang Wenli.

While Reinhard climbs the ranks of the Empire with the aid of his childhood friend, Siegfried Kircheis, he must fight not only the war, but also the remnants of the crumbling Goldenbaum Dynasty in order to free his sister from the Kaiser and unify humanity under one genuine ruler. Meanwhile, on the other side of the galaxy, Yang—a strong supporter of democratic ideals—has to stand firm in his beliefs, despite the struggles of the FPA, and show his pupil, Julian Mintz, that autocracy is not the solution.

As ideologies clash amidst the war''s many casualties, the two strategic masterminds must ask themselves what the real reason behind their battle is.

[Written by MAL Rewrite]', 110, 110, 'finished', 1988, 364955, '2026-05-27T12:00:00.000Z'),
  ('show-014', 'one-piece-fan-letter', 'One Piece Fan Letter', 'https://cdn.myanimelist.net/images/anime/1455/146229l.jpg', NULL, 'Although the golden age of piracy is about to reach new heights, most people do not seek the glory of finding the elusive One Piece—a treasure signifying a new conqueror of all seas that was once embodied by the legendary King of the Pirates, Gol D. Roger. However, even if civilians generally despise pirates, they secretly cheer for at least one of them. 

One red-headed girl from Sabaody Archipelago is no exception: She reveres Nami, the ingenious female navigator of Monkey D. Luffy''s Straw Hat crew. Determined to deliver a fan letter to her idol, the Sabaody child is prepared to challenge forces of authority who strive to prevent Luffy and his friends from departing for their next destination: the New World. But to succeed, Nami''s fan may need to risk her life and interfere with the Marines'' plans, potentially causing devastating consequences for the wider world.

[Written by MAL Rewrite]', 1, 0, 'finished', 2024, 158332, '2026-05-30T12:00:00.000Z'),
  ('show-015', 'gintama-season-5', 'Gintama Season 5', 'https://cdn.myanimelist.net/images/anime/3/83528l.jpg', NULL, 'After joining the resistance against the bakufu, Gintoki and the gang are in hiding, along with Katsura and his Joui rebels. The Yorozuya is soon approached by Nobume Imai and two members of the Kiheitai, who explain that the Harusame pirates have turned against 7th Division Captain Kamui and their former ally Takasugi. The Kiheitai present Gintoki with a job: find Takasugi, who has been missing since his ship was ambushed in a Harusame raid. Nobume also makes a stunning revelation regarding the Tendoushuu, a secret organization pulling the strings of numerous factions, and their leader Utsuro, the shadowy figure with an uncanny resemblance to Gintoki''s former teacher.

Hitching a ride on Sakamoto''s space ship, the Yorozuya and Katsura set out for Rakuyou, Kagura''s home planet, where the various factions have gathered and tensions are brewing. Long-held grudges, political infighting, and the Tendoushuu''s sinister overarching plan finally culminate into a massive, decisive battle on Rakuyou.

[Written by MAL Rewrite]', 12, 12, 'finished', 2017, 350112, '2026-05-23T12:00:00.000Z'),
  ('show-016', 'bleach-thousand-year-blood-war', 'Bleach: Thousand-Year Blood War', 'https://cdn.myanimelist.net/images/anime/1908/135431l.jpg', NULL, 'Substitute Soul Reaper Ichigo Kurosaki spends his days fighting against Hollows, dangerous evil spirits that threaten Karakura Town. Ichigo carries out his quest with his closest allies: Orihime Inoue, his childhood friend with a talent for healing; Yasutora Sado, his high school classmate with superhuman strength; and Uryuu Ishida, Ichigo''s Quincy rival.

Ichigo''s vigilante routine is disrupted by the sudden appearance of Asguiaro Ebern, a dangerous Arrancar who heralds the return of Yhwach, an ancient Quincy king. Yhwach seeks to reignite the historic blood feud between Soul Reaper and Quincy, and he sets his sights on erasing both the human world and the Soul Society for good.

Yhwach launches a two-pronged invasion into both the Soul Society and Hueco Mundo, the home of Hollows and Arrancar. In retaliation, Ichigo and his friends must fight alongside old allies and enemies alike to end Yhwach''s campaign of carnage before the world itself comes to an end.

[Written by MAL Rewrite]', 13, 11, 'finished', 2022, 712213, '2026-05-21T12:00:00.000Z'),
  ('show-017', 'kaguya-sama-love-is-war-ultra-romantic', 'Kaguya-sama: Love is War -Ultra Romantic-', 'https://cdn.myanimelist.net/images/anime/1160/122627l.jpg', NULL, 'The elite members of Shuchiin Academy''s student council continue their competitive day-to-day antics. Council president Miyuki Shirogane clashes daily against vice-president Kaguya Shinomiya, each fighting tooth and nail to trick the other into confessing their romantic love. Kaguya struggles within the strict confines of her wealthy, uptight family, rebelling against her cold default demeanor as she warms to Shirogane and the rest of her friends.

Meanwhile, council treasurer Yuu Ishigami suffers under the weight of his hopeless crush on Tsubame Koyasu, a popular upperclassman who helps to instill a new confidence in him. Miko Iino, the newest student council member, grows closer to the rule-breaking Ishigami while striving to overcome her own authoritarian moral code.

As love further blooms at Shuchiin Academy, the student council officers drag their outsider friends into increasingly comedic conflicts.

[Written by MAL Rewrite]', 13, 11, 'finished', 2022, 1119164, '2026-05-21T12:00:00.000Z'),
  ('show-018', 'fruits-basket-the-final-season', 'Fruits Basket: The Final Season', 'https://cdn.myanimelist.net/images/anime/1085/114792l.jpg', NULL, 'Hundreds of years ago, the Chinese zodiac spirits and their god swore to stay together eternally. United by this promise, the possessed members of the Souma family shall always return to each other under any circumstances. Yet, when these bonds shackle them from freedom, it becomes an undesirable burden—a curse. As head of the clan, Akito is convinced that he shares a special connection with the other Soumas. While he desperately clings to this fantasy, the rest of the family remains isolated and suppressed by the fear of punishment.

Tooru Honda, who has grown attached to the Soumas, is determined to break the chains that bind them. Her companionship with the family and her friends encourages her to move forward with lifting the curse. However, due to confounding revelations, she struggles to find the tenacity to continue her endeavors. With time slowly withering away, Tooru contends with an uncertain future in hopes of reaching the tranquility that may lie beyond all this commotion.

[Written by MAL Rewrite]', 13, 13, 'finished', 2021, 566530, '2026-06-06T12:00:00.000Z'),
  ('show-019', 'clannad-after-story', 'Clannad: After Story', 'https://cdn.myanimelist.net/images/anime/1299/110774l.jpg', NULL, 'Tomoya Okazaki and Nagisa Furukawa have graduated from high school, and together, they experience the emotional rollercoaster of growing up. Unable to decide on a course for his future, Tomoya learns the value of a strong work ethic and discovers the strength of Nagisa''s support. Through the couple''s dedication and unity of purpose, they push forward to confront their personal problems, deepen their old relationships, and create new bonds.

Time also moves on in the Illusionary World. As the plains grow cold with the approach of winter, the Illusionary Girl and the Garbage Doll are presented with a difficult situation that reveals the World''s true purpose.

[Written by MAL Rewrite]', 24, 24, 'finished', 2008, 1290078, '2026-06-09T12:00:00.000Z'),
  ('show-020', 'gintama', 'Gintama', 'https://cdn.myanimelist.net/images/anime/10/73274l.jpg', NULL, 'Edo is a city that was home to the vigor and ambition of samurai across the country. However, following feudal Japan''s surrender to powerful aliens known as the "Amanto," those aspirations now seem unachievable. With the once-influential shogunate rebuilt as a puppet government, a new law is passed that promptly prohibits all swords in public. 

Enter Gintoki Sakata, an eccentric silver-haired man who always carries around a wooden sword and maintains his stature as a samurai despite the ban. As the founder of Yorozuya, a small business for odd jobs, Gintoki often embarks on endeavors to help other people—though usually in rather strange and unforeseen ways. 

Assisted by Shinpachi Shimura, a boy with glasses supposedly learning the way of the samurai; Kagura, a tomboyish girl with superhuman strength and an endless appetite; and Sadaharu, their giant pet dog who loves biting on people''s heads, the Yorozuya encounter anything from alien royalty to scuffles with local gangs in the ever-changing world of Edo.

[Written by MAL Rewrite]', 201, 201, 'finished', 2006, 1158920, '2026-06-02T12:00:00.000Z'),
  ('show-021', 'a-silent-voice', 'A Silent Voice', 'https://cdn.myanimelist.net/images/anime/1122/96435l.jpg', NULL, 'As a wild youth, elementary school student Shouya Ishida sought to beat boredom in the cruelest ways. When the deaf Shouko Nishimiya transfers into his class, Shouya and the rest of his class thoughtlessly bully her for fun. However, when her mother notifies the school, he is singled out and blamed for everything done to her. With Shouko transferring out of the school, Shouya is left at the mercy of his classmates. He is heartlessly ostracized all throughout elementary and middle school, while teachers turn a blind eye.

Now in his third year of high school, Shouya is still plagued by his wrongdoings as a young boy. Sincerely regretting his past actions, he sets out on a journey of redemption: to meet Shouko once more and make amends.

Koe no Katachi tells the heartwarming tale of Shouya''s reunion with Shouko and his honest attempts to redeem himself, all while being continually haunted by the shadows of his past.
 
[Written by MAL Rewrite]', 1, 1, 'finished', 2016, 2628439, '2026-05-28T12:00:00.000Z'),
  ('show-022', 'code-geass-lelouch-of-the-rebellion-r2', 'Code Geass: Lelouch of the Rebellion R2', 'https://cdn.myanimelist.net/images/anime/1088/135089l.jpg', NULL, 'One year has passed since the Black Rebellion, a failed uprising against the Holy Britannian Empire led by the masked vigilante Zero, who is now missing. At a loss without their revolutionary leader, Area 11''s resistance group—the Black Knights—find themselves too powerless to combat the brutality inflicted upon the Elevens by Britannia, which has increased significantly in order to crush any hope of a future revolt. 

Lelouch Lamperouge, having lost all memory of his double life, is living peacefully alongside his friends as a high school student at Ashford Academy. His former partner C.C., unable to accept this turn of events, takes it upon herself to remind him of his past purpose, hoping that the mastermind Zero will rise once again to finish what he started.

[Written by MAL Rewrite]', 25, 25, 'finished', 2008, 1963111, '2026-06-02T12:00:00.000Z'),
  ('show-023', 'the-apothecary-diaries-season-2', 'The Apothecary Diaries Season 2', 'https://cdn.myanimelist.net/images/anime/1025/147458l.jpg', NULL, 'Using her wit and vast knowledge of medicines and poisons alike, Maomao played a pivotal role in solving a series of mysteries and conspiracies that plagued the imperial court. Having recently come to terms with the secrets of her parents, she returns to fulfill her normal duties on behalf of the emperor''s highest-ranking consorts. Maomao also works alongside the eunuch Jinshi to better the consorts'' many ladies-in-waiting, including helping them learn to read.

However, with the arrival of a merchant caravan comes a new wave of intrigue. A pattern of strange coincidences involving the visitors and their wares unsettles Maomao, driving her to investigate the puzzling circumstances behind the convoy. As dangers from both outside and within threaten the balance between the imperial concubines, Maomao continues to utilize her cunning and medical expertise to keep the women safe from harm.

[Written by MAL Rewrite]', 24, 8, 'finished', 2025, 516207, '2026-06-03T12:00:00.000Z'),
  ('show-024', 'march-comes-in-like-a-lion-2nd-season', 'March Comes In Like a Lion 2nd Season', 'https://cdn.myanimelist.net/images/anime/3/88469l.jpg', NULL, 'Now in his second year of high school, Rei Kiriyama continues pushing through his struggles in the professional shogi world as well as his personal life. Surrounded by vibrant personalities at the shogi hall, the school club, and in the local community, his solitary shell slowly begins to crack. Among them are the three Kawamoto sisters—Akari, Hinata, and Momo—who forge an affectionate and familial bond with Rei. Through these ties, he realizes that everyone is burdened by their own emotional hardships and begins learning how to rely on others while supporting them in return. 

Nonetheless, the life of a professional is not easy. Between tournaments, championships, and title matches, the pressure mounts as Rei advances through the ranks and encounters incredibly skilled opponents. As he manages his relationships with those who have grown close to him, the shogi player continues to search for the reason he plays the game that defines his career.

[Written by MAL Rewrite]', 22, 22, 'finished', 2017, 440204, '2026-06-02T12:00:00.000Z'),
('show-025', 'witch-hat-atelier', 'Witch Hat Atelier', 'https://cdn.myanimelist.net/images/anime/1726/155542l.jpg', NULL, 'In a world where witches wield breathtaking magic, Coco, coming from a humble background, often wishes she were born one herself. After all, the secret behind casting magic is strictly guarded from non-witches. But when Coco manages to catch a glimpse of the witch Qifrey casting a spell, her revelation on the truth behind magic drastically alters the course of her life.

However, Coco''s curiosity pays a steep price when a disastrous spell cast in ignorance brings a tragic fate upon her beloved mother. Qifrey takes the shaken girl in, recognizing both her resolve to save her mother and her link to a group of forbidden magic heretics. Secrets are a heavy burden, and between navigating a society that views her as an uninvited guest and mastering the art of magic, Coco must give her all to prove her worth as a witch.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 334452, '2026-06-01T12:00:00.000Z'),
  ('show-026', 'classroom-of-the-elite-4th-season-second-year-first-semester', 'Classroom of the Elite 4th Season: Second Year, First Semester', 'https://cdn.myanimelist.net/images/anime/1176/153626l.jpg', NULL, 'As soon as Kiyotaka Ayanokouji and the rest of Class D officially enter their second year at Tokyo Metropolitan Advanced Nurturing High School, they face their next special test: each second-year student will have to team up with a first-year student to take a written exam. Although the test seems simple enough, every pair must achieve a specific number of points to avoid a harsh penalty, raising the demand for academically proficient individuals.

Without a break, Class D scouts for potential partners. However, Ayanokouji also faces a serious threat since the secret first-rate institution called White Room has enrolled another prodigy at the school to get him expelled. As Ayanokouji begins his masterful schemes once more, he must stay vigilant for new and old enemies alike.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 212418, '2026-06-14T12:00:00.000Z'),
  ('show-027', 'that-time-i-got-reincarnated-as-a-slime-season-4', 'That Time I Got Reincarnated as a Slime Season 4', 'https://cdn.myanimelist.net/images/anime/1695/156389l.jpg', NULL, 'Demon Lord Rimuru''s dream of creating an alliance between humans and monsters takes a step closer to being realized. As Tempest continues to prosper, Granville Rozzo and his granddaughter, Maribel Rozzo, clash with Demon Lord Rimuru over their plan to protect mankind by ruling over them. Meanwhile, in El Dorado, Demon Lord Leon works toward goals of his own. The awakening of a new Hero draws near!

(Source: Crunchyroll)', 11, 0, 'airing', 2026, 207193, '2026-06-12T12:00:00.000Z'),
  ('show-028', 'daemons-of-the-shadow-realm', 'Daemons of the Shadow Realm', 'https://cdn.myanimelist.net/images/anime/1171/156397l.jpg', NULL, 'In an isolated village, two twins were born, separated by day and night. It is years later, and while the older brother Yuru has become a hunter of animals, his sister Asa has been locked away in a cage, ordered to perform a special duty that prohibits her from meeting more than a few select individuals.

On an otherwise inconspicuous day, a group of armed men riding in helicopters, referred to as "dragons" by the citizens, assaults the village in search of Yuru, killing every adult on sight. When Yuru attempts to meet up with Asa and flee, he finds a dead body instead—on top of that, the person who killed her claims to be Yuru''s true twin sister.

Before the woman can capture him, Yuru is rescued by a man named Ryuu "Dera" Tadera, an outsider who frequently visits the village. However, it is not long before the two are cornered. In a last-ditch effort, Dera makes Yuru give a gift to the deity of the village, summoning a pair of daemons whose existence is bound to reveal the truth behind these chaotic events.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 193117, '2026-06-10T12:00:00.000Z'),
  ('show-029', 'wistoria-wand-and-sword-season-2', 'Wistoria: Wand and Sword Season 2', 'https://cdn.myanimelist.net/images/anime/1190/155788l.jpg', NULL, 'As the year nears its end, the time for final exams arrives at Rigarden Magical Academy. Despite being the only student without any magic aptitude, Will Serfort aims to score perfect grades in every subject, which would allow him to ascend to the Wizard''s Tower and reunite with his childhood friend, Elfaria Albis Serfort. However, Will''s hard work comes tumbling down when he fails the very last, biased exam, disqualifying him from entering the Wizard''s Tower.

Meanwhile, Elfaria and the other Magia Vander—the five most powerful mages—perform the annual ritual that protects their world from the dangerous Celestial Hosts. As the ritual temporarily leaves the Magia Vander drained of magic, a large army of monsters suddenly appears and begins attacking mages and civilians alike. To make matters worse, the mages are unable to hold off the invasion due to the monsters'' special weaponry that nullifies their magic. Refusing to let the world end in despair, Will and his masterful swordsmanship quickly become a cornerstone in stopping the attack.

[Written by MAL Rewrite]', 10, 0, 'airing', 2026, 162450, '2026-06-08T12:00:00.000Z'),
  ('show-030', 'dr-stone-science-future-part-3', 'Dr. Stone: Science Future Part 3', 'https://cdn.myanimelist.net/images/anime/1773/155779l.jpg', NULL, 'After reconciling with Dr. Xeno, Senkuu Ishigami is close to realizing his long-held dream: the space mission to the Moon is finally underway. While Dr. Xeno begins the development of their rocket''s engine, Senkuu''s team continues navigating through continents and seas in search of essential resources and people to assemble the necessary infrastructure for the mission as well as revive the entire human population.

Meanwhile, the enigmatic Whyman continues to cast its shadow over Earth from the Moon. But with the combined might of humanity finally coming together, it is only a matter of time before Senkuu and the others confront Whyman and get the answers that have eluded humanity for centuries.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 151633, '2026-06-06T12:00:00.000Z'),
  ('show-031', 'the-angel-next-door-spoils-me-rotten-2', 'The Angel Next Door Spoils Me Rotten 2', 'https://cdn.myanimelist.net/images/anime/1989/154843l.jpg', NULL, 'Second season of Otonari no Tenshi-sama ni Itsunomanika Dame Ningen ni Sareteita Ken.', 11, 0, 'airing', 2026, 144235, '2026-06-04T12:00:00.000Z'),
  ('show-032', 'i-made-friends-with-the-second-prettiest-girl-in-my-class', 'I Made Friends with the Second Prettiest Girl in My Class', 'https://cdn.myanimelist.net/images/anime/1423/155713l.jpg', NULL, 'I, Maehara Maki, struggled to connect with anyone during my high school years, finding it hard to make friends. Then, a turning point arrived. A girl named Asanagi entered my life. Despite being clandestinely referred to as the "second cutest girl in class" by the boys, she chose to spend her Fridays with me instead of her best friend Amami, who held the "cutest girl in class" title. In the comfort of my home, we delved into the realm of games, watched movies, immersed ourselves in manga, indulged in junk food—pizza, hamburgers—and guzzled cola, carefree and content. To the outside world, we might have seemed a bit messy, but to both Asanagi and me, it was a cherished, hidden time together.

(Source: MAL News)', 10, 0, 'airing', 2026, 121520, '2026-06-02T12:00:00.000Z'),
  ('show-033', 'gals-can-t-be-kind-to-otaku', 'Gals Can''t Be Kind to Otaku!?', 'https://cdn.myanimelist.net/images/anime/1956/155456l.jpg', NULL, 'Meet Takuya Seo, an otaku who sits behind the popular gals in class, Ijichi and Amane. Since they''re people from different "castes," you wouldn''t expect them to have much in common. But when their worlds collide over a borrowed eraser, Takuya slips up about his favorite anime, and Amane...is rather quick to correct him. She says she''s not a fan, but her familiarity with the series suggests otherwise. Could she be...a fellow geek?!

(Source: Yen Press)', 10, 0, 'airing', 2026, 94439, '2026-06-15T12:00:00.000Z'),
  ('show-034', 'the-warrior-princess-and-the-barbaric-king', 'The Warrior Princess and the Barbaric King', 'https://cdn.myanimelist.net/images/anime/1229/155022l.jpg', NULL, '"Just kill me!" These are the words of Serafina de Lavillant, the strongest female knight in the West. After being defeated in a war with the East, she has become a prisoner of the barbarians! What awaits the captive Serafina is a life of revenge, torture, and humiliation... or so she thought! What she is offered instead is a marriage to the barbarian king?! An intriguing tale of otherworldly marriage is about to begin!

(Source: Kodansha)', 10, 0, 'airing', 2026, 83569, '2026-06-13T12:00:00.000Z'),
  ('show-035', 'welcome-to-demon-school-iruma-kun-season-4', 'Welcome to Demon School! Iruma-kun Season 4', 'https://cdn.myanimelist.net/images/anime/1434/154048l.jpg', NULL, 'Fourth season of Mairimashita! Iruma-kun.', 11, 0, 'airing', 2026, 78489, '2026-06-11T12:00:00.000Z'),
  ('show-036', 'farming-life-in-another-world-season-2', 'Farming Life in Another World Season 2', 'https://cdn.myanimelist.net/images/anime/1656/156369l.jpg', NULL, 'Second season of Isekai Nonbiri Nouka.', 11, 0, 'airing', 2026, 75483, '2026-06-09T12:00:00.000Z'),
  ('show-037', 'the-beginning-after-the-end-season-2', 'The Beginning After the End Season 2', 'https://cdn.myanimelist.net/images/anime/1738/156028l.jpg', NULL, 'After being granted a second life, now-teenage Arthur Leywin—an unparalleled, ruthless king in his previous life—has finally become an adventurer with the help of his mentor, Jasmine Flamesworth. Although he is still far from his ultimate goal of becoming more powerful than in his past life, Arthur demonstrates remarkable skill in adventuring, exceeding everyone''s expectations.

Meanwhile, Arthur''s elven friend and Elenoir Kingdom''s princess, Tessia Eralith, has also started adventuring. Due to the prolonged hostility between humans and elves, her duty is to spread goodwill and create friendly relations with human kingdoms. However, as a mysterious group threatens to harm the races'' fragile relationship, both Arthur and Tessia soon find themselves becoming pivotal parts of a larger change for the better.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 66738, '2026-06-07T12:00:00.000Z'),
  ('show-038', 'akane-banashi', 'Akane-banashi', 'https://cdn.myanimelist.net/images/anime/1162/155669l.jpg', NULL, 'From a young age, Akane Ousaki has always loved to watch her father, Tooru, practice and perform rakugo, a form of traditional Japanese comedic storytelling. Rakugo performers are split into three ranks, with the highest, shinuchi, only granted to the very best performers after they pass a difficult promotion test. When Tooru takes the exam, Akane experiences her father putting on a stellar performance in front of a big crowd and judges, but the strict main judge, Isshou Arakawa, still fails him, forcing him to quit rakugo.

Ever since, Akane has been diligently practicing rakugo herself. Now a senior in high school, she coincidentally lands a spot to perform in front of a crowd with the help of Shiguma Arakawa, Tooru''s former teacher. Her splendid performance surprises everyone and is just the beginning: Shiguma appoints her as his new apprentice, and with his help, Akane sets out to become a shinuchi in her father''s place.

[Written by MAL Rewrite]', 11, 0, 'airing', 2026, 61775, '2026-06-05T12:00:00.000Z'),
  ('show-039', 'ascendance-of-a-bookworm-adopted-daughter-of-an-archduke', 'Ascendance of a Bookworm: Adopted Daughter of an Archduke', 'https://cdn.myanimelist.net/images/anime/1371/155054l.jpg', NULL, 'Anime adaptation of part three of the Honzuki no Gekokujou light novel.', 11, 0, 'airing', 2026, 79008, '2026-06-03T12:00:00.000Z');

-- show_genres (join) -------------------------------------------------------
insert into public.show_genres (show_id, genre_id) values
  ('show-001', 'gen-001'),
  ('show-001', 'gen-002'),
  ('show-001', 'gen-003'),
  ('show-001', 'gen-004'),
  ('show-002', 'gen-005'),
  ('show-002', 'gen-001'),
  ('show-002', 'gen-006'),
  ('show-002', 'gen-007'),
  ('show-003', 'gen-005'),
  ('show-003', 'gen-001'),
  ('show-003', 'gen-003'),
  ('show-003', 'gen-004'),
  ('show-004', 'gen-005'),
  ('show-004', 'gen-004'),
  ('show-005', 'gen-003'),
  ('show-005', 'gen-008'),
  ('show-005', 'gen-009'),
  ('show-006', 'gen-005'),
  ('show-006', 'gen-003'),
  ('show-006', 'gen-009'),
  ('show-007', 'gen-005'),
  ('show-007', 'gen-010'),
  ('show-007', 'gen-008'),
  ('show-008', 'gen-005'),
  ('show-008', 'gen-010'),
  ('show-008', 'gen-003'),
  ('show-008', 'gen-008'),
  ('show-009', 'gen-003'),
  ('show-009', 'gen-004'),
  ('show-009', 'gen-009'),
  ('show-010', 'gen-005'),
  ('show-010', 'gen-001'),
  ('show-010', 'gen-004'),
  ('show-011', 'gen-005'),
  ('show-011', 'gen-010'),
  ('show-011', 'gen-008'),
  ('show-012', 'gen-005'),
  ('show-012', 'gen-010'),
  ('show-012', 'gen-008'),
  ('show-013', 'gen-003'),
  ('show-013', 'gen-008'),
  ('show-014', 'gen-005'),
  ('show-014', 'gen-001'),
  ('show-014', 'gen-004'),
  ('show-015', 'gen-005'),
  ('show-015', 'gen-010'),
  ('show-015', 'gen-008'),
  ('show-016', 'gen-005'),
  ('show-016', 'gen-001'),
  ('show-016', 'gen-007'),
  ('show-017', 'gen-010'),
  ('show-017', 'gen-011'),
  ('show-018', 'gen-003'),
  ('show-018', 'gen-011'),
  ('show-018', 'gen-007'),
  ('show-019', 'gen-003'),
  ('show-019', 'gen-011'),
  ('show-020', 'gen-005'),
  ('show-020', 'gen-010'),
  ('show-020', 'gen-008'),
  ('show-021', 'gen-002'),
  ('show-021', 'gen-003'),
  ('show-022', 'gen-002'),
  ('show-022', 'gen-003'),
  ('show-022', 'gen-008'),
  ('show-023', 'gen-003'),
  ('show-023', 'gen-006'),
  ('show-024', 'gen-003'),
('show-025', 'gen-004'),
  ('show-026', 'gen-003'),
  ('show-026', 'gen-009'),
  ('show-027', 'gen-005'),
  ('show-027', 'gen-010'),
  ('show-027', 'gen-004'),
  ('show-028', 'gen-005'),
  ('show-028', 'gen-001'),
  ('show-028', 'gen-007'),
  ('show-029', 'gen-005'),
  ('show-029', 'gen-004'),
  ('show-030', 'gen-001'),
  ('show-030', 'gen-010'),
  ('show-031', 'gen-011'),
  ('show-032', 'gen-011'),
  ('show-033', 'gen-010'),
  ('show-033', 'gen-011'),
  ('show-034', 'gen-010'),
  ('show-034', 'gen-004'),
  ('show-034', 'gen-011'),
  ('show-035', 'gen-010'),
  ('show-035', 'gen-004'),
  ('show-036', 'gen-004'),
  ('show-036', 'gen-012'),
  ('show-037', 'gen-004'),
  ('show-038', 'gen-003'),
  ('show-039', 'gen-004');

-- episodes -----------------------------------------------------------------
insert into public.episodes (id, show_id, number, title, is_subbed, is_dubbed, air_date, video_url) values
  ('show-001-ep-001', 'show-001', 1, 'Episode 1', TRUE, TRUE, '2025-12-16', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-001-ep-002', 'show-001', 2, 'Episode 2', TRUE, TRUE, '2025-12-23', NULL),
  ('show-001-ep-003', 'show-001', 3, 'Episode 3', TRUE, TRUE, '2025-12-30', NULL),
  ('show-001-ep-004', 'show-001', 4, 'Episode 4', TRUE, TRUE, '2026-01-06', NULL),
  ('show-001-ep-005', 'show-001', 5, 'Episode 5', TRUE, TRUE, '2026-01-13', NULL),
  ('show-001-ep-006', 'show-001', 6, 'Episode 6', TRUE, TRUE, '2026-01-20', NULL),
  ('show-001-ep-007', 'show-001', 7, 'Episode 7', TRUE, TRUE, '2026-01-27', NULL),
  ('show-001-ep-008', 'show-001', 8, 'Episode 8', TRUE, TRUE, '2026-02-03', NULL),
  ('show-001-ep-009', 'show-001', 9, 'Episode 9', TRUE, TRUE, '2026-02-10', NULL),
  ('show-001-ep-010', 'show-001', 10, 'Episode 10', TRUE, TRUE, '2026-02-17', NULL),
  ('show-001-ep-011', 'show-001', 11, 'Episode 11', TRUE, TRUE, '2026-02-24', NULL),
  ('show-001-ep-012', 'show-001', 12, 'Episode 12', TRUE, TRUE, '2026-03-03', NULL),
  ('show-001-ep-013', 'show-001', 13, 'Episode 13', TRUE, TRUE, '2026-03-10', NULL),
  ('show-001-ep-014', 'show-001', 14, 'Episode 14', TRUE, TRUE, '2026-03-17', NULL),
  ('show-001-ep-015', 'show-001', 15, 'Episode 15', TRUE, TRUE, '2026-03-24', NULL),
  ('show-001-ep-016', 'show-001', 16, 'Episode 16', TRUE, TRUE, '2026-03-31', NULL),
  ('show-001-ep-017', 'show-001', 17, 'Episode 17', TRUE, TRUE, '2026-04-07', NULL),
  ('show-001-ep-018', 'show-001', 18, 'Episode 18', TRUE, TRUE, '2026-04-14', NULL),
  ('show-001-ep-019', 'show-001', 19, 'Episode 19', TRUE, TRUE, '2026-04-21', NULL),
  ('show-001-ep-020', 'show-001', 20, 'Episode 20', TRUE, FALSE, '2026-04-28', NULL),
  ('show-001-ep-021', 'show-001', 21, 'Episode 21', TRUE, FALSE, '2026-05-05', NULL),
  ('show-001-ep-022', 'show-001', 22, 'Episode 22', TRUE, FALSE, '2026-05-12', NULL),
  ('show-001-ep-023', 'show-001', 23, 'Episode 23', TRUE, FALSE, '2026-05-19', NULL),
  ('show-001-ep-024', 'show-001', 24, 'Episode 24', TRUE, FALSE, '2026-05-26', NULL),
  ('show-001-ep-025', 'show-001', 25, 'Episode 25', TRUE, FALSE, '2026-06-02', NULL),
  ('show-001-ep-026', 'show-001', 26, 'Episode 26', TRUE, FALSE, '2026-06-09', NULL),
  ('show-002-ep-001', 'show-002', 1, 'Episode 1', TRUE, FALSE, '2026-03-29', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-002-ep-002', 'show-002', 2, 'Episode 2', TRUE, FALSE, '2026-04-05', NULL),
  ('show-002-ep-003', 'show-002', 3, 'Episode 3', TRUE, FALSE, '2026-04-12', NULL),
  ('show-002-ep-004', 'show-002', 4, 'Episode 4', TRUE, FALSE, '2026-04-19', NULL),
  ('show-002-ep-005', 'show-002', 5, 'Episode 5', TRUE, FALSE, '2026-04-26', NULL),
  ('show-002-ep-006', 'show-002', 6, 'Episode 6', TRUE, FALSE, '2026-05-03', NULL),
  ('show-002-ep-007', 'show-002', 7, 'Episode 7', TRUE, FALSE, '2026-05-10', NULL),
  ('show-002-ep-008', 'show-002', 8, 'Episode 8', TRUE, FALSE, '2026-05-17', NULL),
  ('show-002-ep-009', 'show-002', 9, 'Episode 9', TRUE, FALSE, '2026-05-24', NULL),
  ('show-002-ep-010', 'show-002', 10, 'Episode 10', TRUE, FALSE, '2026-05-31', NULL),
  ('show-002-ep-011', 'show-002', 11, 'Episode 11', TRUE, FALSE, '2026-06-07', NULL),
  ('show-002-ep-012', 'show-002', 12, 'Episode 12', TRUE, FALSE, '2026-06-14', NULL),
  ('show-003-ep-001', 'show-003', 1, 'Episode 1', TRUE, TRUE, '2025-11-25', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-003-ep-002', 'show-003', 2, 'Episode 2', TRUE, TRUE, '2025-12-02', NULL),
  ('show-003-ep-003', 'show-003', 3, 'Episode 3', TRUE, TRUE, '2025-12-09', NULL),
  ('show-003-ep-004', 'show-003', 4, 'Episode 4', TRUE, TRUE, '2025-12-16', NULL),
  ('show-003-ep-005', 'show-003', 5, 'Episode 5', TRUE, TRUE, '2025-12-23', NULL),
  ('show-003-ep-006', 'show-003', 6, 'Episode 6', TRUE, TRUE, '2025-12-30', NULL),
  ('show-003-ep-007', 'show-003', 7, 'Episode 7', TRUE, TRUE, '2026-01-06', NULL),
  ('show-003-ep-008', 'show-003', 8, 'Episode 8', TRUE, TRUE, '2026-01-13', NULL),
  ('show-003-ep-009', 'show-003', 9, 'Episode 9', TRUE, TRUE, '2026-01-20', NULL),
  ('show-003-ep-010', 'show-003', 10, 'Episode 10', TRUE, TRUE, '2026-01-27', NULL),
  ('show-003-ep-011', 'show-003', 11, 'Episode 11', TRUE, TRUE, '2026-02-03', NULL),
  ('show-003-ep-012', 'show-003', 12, 'Episode 12', TRUE, TRUE, '2026-02-10', NULL),
  ('show-003-ep-013', 'show-003', 13, 'Episode 13', TRUE, TRUE, '2026-02-17', NULL),
  ('show-003-ep-014', 'show-003', 14, 'Episode 14', TRUE, TRUE, '2026-02-24', NULL),
  ('show-003-ep-015', 'show-003', 15, 'Episode 15', TRUE, TRUE, '2026-03-03', NULL),
  ('show-003-ep-016', 'show-003', 16, 'Episode 16', TRUE, TRUE, '2026-03-10', NULL),
  ('show-003-ep-017', 'show-003', 17, 'Episode 17', TRUE, TRUE, '2026-03-17', NULL),
  ('show-003-ep-018', 'show-003', 18, 'Episode 18', TRUE, TRUE, '2026-03-24', NULL),
  ('show-003-ep-019', 'show-003', 19, 'Episode 19', TRUE, TRUE, '2026-03-31', NULL),
  ('show-003-ep-020', 'show-003', 20, 'Episode 20', TRUE, TRUE, '2026-04-07', NULL),
  ('show-003-ep-021', 'show-003', 21, 'Episode 21', TRUE, TRUE, '2026-04-14', NULL),
  ('show-003-ep-022', 'show-003', 22, 'Episode 22', TRUE, TRUE, '2026-04-21', NULL),
  ('show-003-ep-023', 'show-003', 23, 'Episode 23', TRUE, TRUE, '2026-04-28', NULL),
  ('show-003-ep-024', 'show-003', 24, 'Episode 24', TRUE, TRUE, '2026-05-05', NULL),
  ('show-003-ep-025', 'show-003', 25, 'Episode 25', TRUE, TRUE, '2026-05-12', NULL),
  ('show-003-ep-026', 'show-003', 26, 'Episode 26', TRUE, TRUE, '2026-05-19', NULL),
  ('show-004-ep-001', 'show-004', 1, 'Episode 1', TRUE, FALSE, '2026-05-31', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-005-ep-001', 'show-005', 1, 'Episode 1', TRUE, TRUE, '2025-12-29', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-005-ep-002', 'show-005', 2, 'Episode 2', TRUE, TRUE, '2026-01-05', NULL),
  ('show-005-ep-003', 'show-005', 3, 'Episode 3', TRUE, TRUE, '2026-01-12', NULL),
  ('show-005-ep-004', 'show-005', 4, 'Episode 4', TRUE, TRUE, '2026-01-19', NULL),
  ('show-005-ep-005', 'show-005', 5, 'Episode 5', TRUE, TRUE, '2026-01-26', NULL),
  ('show-005-ep-006', 'show-005', 6, 'Episode 6', TRUE, TRUE, '2026-02-02', NULL),
  ('show-005-ep-007', 'show-005', 7, 'Episode 7', TRUE, TRUE, '2026-02-09', NULL),
  ('show-005-ep-008', 'show-005', 8, 'Episode 8', TRUE, TRUE, '2026-02-16', NULL),
  ('show-005-ep-009', 'show-005', 9, 'Episode 9', TRUE, TRUE, '2026-02-23', NULL),
  ('show-005-ep-010', 'show-005', 10, 'Episode 10', TRUE, TRUE, '2026-03-02', NULL),
  ('show-005-ep-011', 'show-005', 11, 'Episode 11', TRUE, TRUE, '2026-03-09', NULL),
  ('show-005-ep-012', 'show-005', 12, 'Episode 12', TRUE, TRUE, '2026-03-16', NULL),
  ('show-005-ep-013', 'show-005', 13, 'Episode 13', TRUE, TRUE, '2026-03-23', NULL),
  ('show-005-ep-014', 'show-005', 14, 'Episode 14', TRUE, TRUE, '2026-03-30', NULL),
  ('show-005-ep-015', 'show-005', 15, 'Episode 15', TRUE, TRUE, '2026-04-06', NULL),
  ('show-005-ep-016', 'show-005', 16, 'Episode 16', TRUE, TRUE, '2026-04-13', NULL),
  ('show-005-ep-017', 'show-005', 17, 'Episode 17', TRUE, TRUE, '2026-04-20', NULL),
  ('show-005-ep-018', 'show-005', 18, 'Episode 18', TRUE, TRUE, '2026-04-27', NULL),
  ('show-005-ep-019', 'show-005', 19, 'Episode 19', TRUE, TRUE, '2026-05-04', NULL),
  ('show-005-ep-020', 'show-005', 20, 'Episode 20', TRUE, TRUE, '2026-05-11', NULL),
  ('show-005-ep-021', 'show-005', 21, 'Episode 21', TRUE, TRUE, '2026-05-18', NULL),
  ('show-005-ep-022', 'show-005', 22, 'Episode 22', TRUE, TRUE, '2026-05-25', NULL),
  ('show-005-ep-023', 'show-005', 23, 'Episode 23', TRUE, TRUE, '2026-06-01', NULL),
  ('show-005-ep-024', 'show-005', 24, 'Episode 24', TRUE, TRUE, '2026-06-08', NULL),
  ('show-006-ep-001', 'show-006', 1, 'Episode 1', TRUE, TRUE, '2026-04-10', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-006-ep-002', 'show-006', 2, 'Episode 2', TRUE, TRUE, '2026-04-17', NULL),
  ('show-006-ep-003', 'show-006', 3, 'Episode 3', TRUE, TRUE, '2026-04-24', NULL),
  ('show-006-ep-004', 'show-006', 4, 'Episode 4', TRUE, TRUE, '2026-05-01', NULL),
  ('show-006-ep-005', 'show-006', 5, 'Episode 5', TRUE, TRUE, '2026-05-08', NULL),
  ('show-006-ep-006', 'show-006', 6, 'Episode 6', TRUE, TRUE, '2026-05-15', NULL),
  ('show-006-ep-007', 'show-006', 7, 'Episode 7', TRUE, TRUE, '2026-05-22', NULL),
  ('show-006-ep-008', 'show-006', 8, 'Episode 8', TRUE, TRUE, '2026-05-29', NULL),
  ('show-006-ep-009', 'show-006', 9, 'Episode 9', TRUE, TRUE, '2026-06-05', NULL),
  ('show-006-ep-010', 'show-006', 10, 'Episode 10', TRUE, TRUE, '2026-06-12', NULL),
  ('show-007-ep-001', 'show-007', 1, 'Episode 1', TRUE, TRUE, '2025-12-10', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-007-ep-002', 'show-007', 2, 'Episode 2', TRUE, TRUE, '2025-12-17', NULL),
  ('show-007-ep-003', 'show-007', 3, 'Episode 3', TRUE, TRUE, '2025-12-24', NULL),
  ('show-007-ep-004', 'show-007', 4, 'Episode 4', TRUE, TRUE, '2025-12-31', NULL),
  ('show-007-ep-005', 'show-007', 5, 'Episode 5', TRUE, TRUE, '2026-01-07', NULL),
  ('show-007-ep-006', 'show-007', 6, 'Episode 6', TRUE, TRUE, '2026-01-14', NULL),
  ('show-007-ep-007', 'show-007', 7, 'Episode 7', TRUE, TRUE, '2026-01-21', NULL),
  ('show-007-ep-008', 'show-007', 8, 'Episode 8', TRUE, TRUE, '2026-01-28', NULL),
  ('show-007-ep-009', 'show-007', 9, 'Episode 9', TRUE, TRUE, '2026-02-04', NULL),
  ('show-007-ep-010', 'show-007', 10, 'Episode 10', TRUE, TRUE, '2026-02-11', NULL),
  ('show-007-ep-011', 'show-007', 11, 'Episode 11', TRUE, TRUE, '2026-02-18', NULL),
  ('show-007-ep-012', 'show-007', 12, 'Episode 12', TRUE, TRUE, '2026-02-25', NULL),
  ('show-007-ep-013', 'show-007', 13, 'Episode 13', TRUE, TRUE, '2026-03-04', NULL),
  ('show-007-ep-014', 'show-007', 14, 'Episode 14', TRUE, TRUE, '2026-03-11', NULL),
  ('show-007-ep-015', 'show-007', 15, 'Episode 15', TRUE, TRUE, '2026-03-18', NULL),
  ('show-007-ep-016', 'show-007', 16, 'Episode 16', TRUE, TRUE, '2026-03-25', NULL),
  ('show-007-ep-017', 'show-007', 17, 'Episode 17', TRUE, TRUE, '2026-04-01', NULL),
  ('show-007-ep-018', 'show-007', 18, 'Episode 18', TRUE, TRUE, '2026-04-08', NULL),
  ('show-007-ep-019', 'show-007', 19, 'Episode 19', TRUE, TRUE, '2026-04-15', NULL),
  ('show-007-ep-020', 'show-007', 20, 'Episode 20', TRUE, TRUE, '2026-04-22', NULL),
  ('show-007-ep-021', 'show-007', 21, 'Episode 21', TRUE, TRUE, '2026-04-29', NULL),
  ('show-007-ep-022', 'show-007', 22, 'Episode 22', TRUE, TRUE, '2026-05-06', NULL),
  ('show-007-ep-023', 'show-007', 23, 'Episode 23', TRUE, TRUE, '2026-05-13', NULL),
  ('show-007-ep-024', 'show-007', 24, 'Episode 24', TRUE, TRUE, '2026-05-20', NULL),
  ('show-007-ep-025', 'show-007', 25, 'Episode 25', TRUE, TRUE, '2026-05-27', NULL),
  ('show-007-ep-026', 'show-007', 26, 'Episode 26', TRUE, TRUE, '2026-06-03', NULL),
  ('show-008-ep-001', 'show-008', 1, 'Episode 1', TRUE, TRUE, '2026-06-04', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-009-ep-001', 'show-009', 1, 'Episode 1', TRUE, TRUE, '2026-02-09', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-009-ep-002', 'show-009', 2, 'Episode 2', TRUE, TRUE, '2026-02-16', NULL),
  ('show-009-ep-003', 'show-009', 3, 'Episode 3', TRUE, TRUE, '2026-02-23', NULL),
  ('show-009-ep-004', 'show-009', 4, 'Episode 4', TRUE, TRUE, '2026-03-02', NULL),
  ('show-009-ep-005', 'show-009', 5, 'Episode 5', TRUE, TRUE, '2026-03-09', NULL),
  ('show-009-ep-006', 'show-009', 6, 'Episode 6', TRUE, TRUE, '2026-03-16', NULL),
  ('show-009-ep-007', 'show-009', 7, 'Episode 7', TRUE, FALSE, '2026-03-23', NULL),
  ('show-009-ep-008', 'show-009', 8, 'Episode 8', TRUE, FALSE, '2026-03-30', NULL),
  ('show-009-ep-009', 'show-009', 9, 'Episode 9', TRUE, FALSE, '2026-04-06', NULL),
  ('show-009-ep-010', 'show-009', 10, 'Episode 10', TRUE, FALSE, '2026-04-13', NULL),
  ('show-009-ep-011', 'show-009', 11, 'Episode 11', TRUE, FALSE, '2026-04-20', NULL),
  ('show-009-ep-012', 'show-009', 12, 'Episode 12', TRUE, FALSE, '2026-04-27', NULL),
  ('show-009-ep-013', 'show-009', 13, 'Episode 13', TRUE, FALSE, '2026-05-04', NULL),
  ('show-009-ep-014', 'show-009', 14, 'Episode 14', TRUE, FALSE, '2026-05-11', NULL),
  ('show-009-ep-015', 'show-009', 15, 'Episode 15', TRUE, FALSE, '2026-05-18', NULL),
  ('show-009-ep-016', 'show-009', 16, 'Episode 16', TRUE, FALSE, '2026-05-25', NULL),
  ('show-009-ep-017', 'show-009', 17, 'Episode 17', TRUE, FALSE, '2026-06-01', NULL),
  ('show-009-ep-018', 'show-009', 18, 'Episode 18', TRUE, FALSE, '2026-06-08', NULL),
  ('show-009-ep-019', 'show-009', 19, 'Episode 19', TRUE, FALSE, '2026-06-15', NULL),
  ('show-010-ep-001', 'show-010', 1, 'Episode 1', TRUE, TRUE, '2025-12-05', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-010-ep-002', 'show-010', 2, 'Episode 2', TRUE, TRUE, '2025-12-12', NULL),
  ('show-010-ep-003', 'show-010', 3, 'Episode 3', TRUE, TRUE, '2025-12-19', NULL),
  ('show-010-ep-004', 'show-010', 4, 'Episode 4', TRUE, TRUE, '2025-12-26', NULL),
  ('show-010-ep-005', 'show-010', 5, 'Episode 5', TRUE, TRUE, '2026-01-02', NULL),
  ('show-010-ep-006', 'show-010', 6, 'Episode 6', TRUE, TRUE, '2026-01-09', NULL),
  ('show-010-ep-007', 'show-010', 7, 'Episode 7', TRUE, TRUE, '2026-01-16', NULL),
  ('show-010-ep-008', 'show-010', 8, 'Episode 8', TRUE, TRUE, '2026-01-23', NULL),
  ('show-010-ep-009', 'show-010', 9, 'Episode 9', TRUE, TRUE, '2026-01-30', NULL),
  ('show-010-ep-010', 'show-010', 10, 'Episode 10', TRUE, TRUE, '2026-02-06', NULL),
  ('show-010-ep-011', 'show-010', 11, 'Episode 11', TRUE, TRUE, '2026-02-13', NULL),
  ('show-010-ep-012', 'show-010', 12, 'Episode 12', TRUE, TRUE, '2026-02-20', NULL),
  ('show-010-ep-013', 'show-010', 13, 'Episode 13', TRUE, TRUE, '2026-02-27', NULL),
  ('show-010-ep-014', 'show-010', 14, 'Episode 14', TRUE, TRUE, '2026-03-06', NULL),
  ('show-010-ep-015', 'show-010', 15, 'Episode 15', TRUE, TRUE, '2026-03-13', NULL),
  ('show-010-ep-016', 'show-010', 16, 'Episode 16', TRUE, TRUE, '2026-03-20', NULL),
  ('show-010-ep-017', 'show-010', 17, 'Episode 17', TRUE, TRUE, '2026-03-27', NULL),
  ('show-010-ep-018', 'show-010', 18, 'Episode 18', TRUE, TRUE, '2026-04-03', NULL),
  ('show-010-ep-019', 'show-010', 19, 'Episode 19', TRUE, TRUE, '2026-04-10', NULL),
  ('show-010-ep-020', 'show-010', 20, 'Episode 20', TRUE, TRUE, '2026-04-17', NULL),
  ('show-010-ep-021', 'show-010', 21, 'Episode 21', TRUE, TRUE, '2026-04-24', NULL),
  ('show-010-ep-022', 'show-010', 22, 'Episode 22', TRUE, TRUE, '2026-05-01', NULL),
  ('show-010-ep-023', 'show-010', 23, 'Episode 23', TRUE, TRUE, '2026-05-08', NULL),
  ('show-010-ep-024', 'show-010', 24, 'Episode 24', TRUE, TRUE, '2026-05-15', NULL),
  ('show-010-ep-025', 'show-010', 25, 'Episode 25', TRUE, TRUE, '2026-05-22', NULL),
  ('show-010-ep-026', 'show-010', 26, 'Episode 26', TRUE, TRUE, '2026-05-29', NULL),
  ('show-011-ep-001', 'show-011', 1, 'Episode 1', TRUE, TRUE, '2025-11-28', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-011-ep-002', 'show-011', 2, 'Episode 2', TRUE, TRUE, '2025-12-05', NULL),
  ('show-011-ep-003', 'show-011', 3, 'Episode 3', TRUE, TRUE, '2025-12-12', NULL),
  ('show-011-ep-004', 'show-011', 4, 'Episode 4', TRUE, TRUE, '2025-12-19', NULL),
  ('show-011-ep-005', 'show-011', 5, 'Episode 5', TRUE, TRUE, '2025-12-26', NULL),
  ('show-011-ep-006', 'show-011', 6, 'Episode 6', TRUE, TRUE, '2026-01-02', NULL),
  ('show-011-ep-007', 'show-011', 7, 'Episode 7', TRUE, TRUE, '2026-01-09', NULL),
  ('show-011-ep-008', 'show-011', 8, 'Episode 8', TRUE, TRUE, '2026-01-16', NULL),
  ('show-011-ep-009', 'show-011', 9, 'Episode 9', TRUE, TRUE, '2026-01-23', NULL),
  ('show-011-ep-010', 'show-011', 10, 'Episode 10', TRUE, TRUE, '2026-01-30', NULL),
  ('show-011-ep-011', 'show-011', 11, 'Episode 11', TRUE, TRUE, '2026-02-06', NULL),
  ('show-011-ep-012', 'show-011', 12, 'Episode 12', TRUE, TRUE, '2026-02-13', NULL),
  ('show-011-ep-013', 'show-011', 13, 'Episode 13', TRUE, TRUE, '2026-02-20', NULL),
  ('show-011-ep-014', 'show-011', 14, 'Episode 14', TRUE, TRUE, '2026-02-27', NULL),
  ('show-011-ep-015', 'show-011', 15, 'Episode 15', TRUE, TRUE, '2026-03-06', NULL),
  ('show-011-ep-016', 'show-011', 16, 'Episode 16', TRUE, TRUE, '2026-03-13', NULL),
  ('show-011-ep-017', 'show-011', 17, 'Episode 17', TRUE, TRUE, '2026-03-20', NULL),
  ('show-011-ep-018', 'show-011', 18, 'Episode 18', TRUE, TRUE, '2026-03-27', NULL),
  ('show-011-ep-019', 'show-011', 19, 'Episode 19', TRUE, TRUE, '2026-04-03', NULL),
  ('show-011-ep-020', 'show-011', 20, 'Episode 20', TRUE, TRUE, '2026-04-10', NULL),
  ('show-011-ep-021', 'show-011', 21, 'Episode 21', TRUE, TRUE, '2026-04-17', NULL),
  ('show-011-ep-022', 'show-011', 22, 'Episode 22', TRUE, TRUE, '2026-04-24', NULL),
  ('show-011-ep-023', 'show-011', 23, 'Episode 23', TRUE, TRUE, '2026-05-01', NULL),
  ('show-011-ep-024', 'show-011', 24, 'Episode 24', TRUE, TRUE, '2026-05-08', NULL),
  ('show-011-ep-025', 'show-011', 25, 'Episode 25', TRUE, TRUE, '2026-05-15', NULL),
  ('show-011-ep-026', 'show-011', 26, 'Episode 26', TRUE, TRUE, '2026-05-22', NULL),
  ('show-012-ep-001', 'show-012', 1, 'Episode 1', TRUE, TRUE, '2026-02-22', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-012-ep-002', 'show-012', 2, 'Episode 2', TRUE, TRUE, '2026-03-01', NULL),
  ('show-012-ep-003', 'show-012', 3, 'Episode 3', TRUE, TRUE, '2026-03-08', NULL),
  ('show-012-ep-004', 'show-012', 4, 'Episode 4', TRUE, TRUE, '2026-03-15', NULL),
  ('show-012-ep-005', 'show-012', 5, 'Episode 5', TRUE, TRUE, '2026-03-22', NULL),
  ('show-012-ep-006', 'show-012', 6, 'Episode 6', TRUE, TRUE, '2026-03-29', NULL),
  ('show-012-ep-007', 'show-012', 7, 'Episode 7', TRUE, TRUE, '2026-04-05', NULL),
  ('show-012-ep-008', 'show-012', 8, 'Episode 8', TRUE, TRUE, '2026-04-12', NULL),
  ('show-012-ep-009', 'show-012', 9, 'Episode 9', TRUE, TRUE, '2026-04-19', NULL),
  ('show-012-ep-010', 'show-012', 10, 'Episode 10', TRUE, TRUE, '2026-04-26', NULL),
  ('show-012-ep-011', 'show-012', 11, 'Episode 11', TRUE, TRUE, '2026-05-03', NULL),
  ('show-012-ep-012', 'show-012', 12, 'Episode 12', TRUE, TRUE, '2026-05-10', NULL),
  ('show-012-ep-013', 'show-012', 13, 'Episode 13', TRUE, TRUE, '2026-05-17', NULL),
  ('show-013-ep-001', 'show-013', 1, 'Episode 1', TRUE, TRUE, '2025-12-03', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-013-ep-002', 'show-013', 2, 'Episode 2', TRUE, TRUE, '2025-12-10', NULL),
  ('show-013-ep-003', 'show-013', 3, 'Episode 3', TRUE, TRUE, '2025-12-17', NULL),
  ('show-013-ep-004', 'show-013', 4, 'Episode 4', TRUE, TRUE, '2025-12-24', NULL),
  ('show-013-ep-005', 'show-013', 5, 'Episode 5', TRUE, TRUE, '2025-12-31', NULL),
  ('show-013-ep-006', 'show-013', 6, 'Episode 6', TRUE, TRUE, '2026-01-07', NULL),
  ('show-013-ep-007', 'show-013', 7, 'Episode 7', TRUE, TRUE, '2026-01-14', NULL),
  ('show-013-ep-008', 'show-013', 8, 'Episode 8', TRUE, TRUE, '2026-01-21', NULL),
  ('show-013-ep-009', 'show-013', 9, 'Episode 9', TRUE, TRUE, '2026-01-28', NULL),
  ('show-013-ep-010', 'show-013', 10, 'Episode 10', TRUE, TRUE, '2026-02-04', NULL),
  ('show-013-ep-011', 'show-013', 11, 'Episode 11', TRUE, TRUE, '2026-02-11', NULL),
  ('show-013-ep-012', 'show-013', 12, 'Episode 12', TRUE, TRUE, '2026-02-18', NULL),
  ('show-013-ep-013', 'show-013', 13, 'Episode 13', TRUE, TRUE, '2026-02-25', NULL),
  ('show-013-ep-014', 'show-013', 14, 'Episode 14', TRUE, TRUE, '2026-03-04', NULL),
  ('show-013-ep-015', 'show-013', 15, 'Episode 15', TRUE, TRUE, '2026-03-11', NULL),
  ('show-013-ep-016', 'show-013', 16, 'Episode 16', TRUE, TRUE, '2026-03-18', NULL),
  ('show-013-ep-017', 'show-013', 17, 'Episode 17', TRUE, TRUE, '2026-03-25', NULL),
  ('show-013-ep-018', 'show-013', 18, 'Episode 18', TRUE, TRUE, '2026-04-01', NULL),
  ('show-013-ep-019', 'show-013', 19, 'Episode 19', TRUE, TRUE, '2026-04-08', NULL),
  ('show-013-ep-020', 'show-013', 20, 'Episode 20', TRUE, TRUE, '2026-04-15', NULL),
  ('show-013-ep-021', 'show-013', 21, 'Episode 21', TRUE, TRUE, '2026-04-22', NULL),
  ('show-013-ep-022', 'show-013', 22, 'Episode 22', TRUE, TRUE, '2026-04-29', NULL),
  ('show-013-ep-023', 'show-013', 23, 'Episode 23', TRUE, TRUE, '2026-05-06', NULL),
  ('show-013-ep-024', 'show-013', 24, 'Episode 24', TRUE, TRUE, '2026-05-13', NULL),
  ('show-013-ep-025', 'show-013', 25, 'Episode 25', TRUE, TRUE, '2026-05-20', NULL),
  ('show-013-ep-026', 'show-013', 26, 'Episode 26', TRUE, TRUE, '2026-05-27', NULL),
  ('show-014-ep-001', 'show-014', 1, 'Episode 1', TRUE, FALSE, '2026-05-30', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-015-ep-001', 'show-015', 1, 'Episode 1', TRUE, TRUE, '2026-03-07', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-015-ep-002', 'show-015', 2, 'Episode 2', TRUE, TRUE, '2026-03-14', NULL),
  ('show-015-ep-003', 'show-015', 3, 'Episode 3', TRUE, TRUE, '2026-03-21', NULL),
  ('show-015-ep-004', 'show-015', 4, 'Episode 4', TRUE, TRUE, '2026-03-28', NULL),
  ('show-015-ep-005', 'show-015', 5, 'Episode 5', TRUE, TRUE, '2026-04-04', NULL),
  ('show-015-ep-006', 'show-015', 6, 'Episode 6', TRUE, TRUE, '2026-04-11', NULL),
  ('show-015-ep-007', 'show-015', 7, 'Episode 7', TRUE, TRUE, '2026-04-18', NULL),
  ('show-015-ep-008', 'show-015', 8, 'Episode 8', TRUE, TRUE, '2026-04-25', NULL),
  ('show-015-ep-009', 'show-015', 9, 'Episode 9', TRUE, TRUE, '2026-05-02', NULL),
  ('show-015-ep-010', 'show-015', 10, 'Episode 10', TRUE, TRUE, '2026-05-09', NULL),
  ('show-015-ep-011', 'show-015', 11, 'Episode 11', TRUE, TRUE, '2026-05-16', NULL),
  ('show-015-ep-012', 'show-015', 12, 'Episode 12', TRUE, TRUE, '2026-05-23', NULL),
  ('show-016-ep-001', 'show-016', 1, 'Episode 1', TRUE, TRUE, '2026-02-26', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-016-ep-002', 'show-016', 2, 'Episode 2', TRUE, TRUE, '2026-03-05', NULL),
  ('show-016-ep-003', 'show-016', 3, 'Episode 3', TRUE, TRUE, '2026-03-12', NULL),
  ('show-016-ep-004', 'show-016', 4, 'Episode 4', TRUE, TRUE, '2026-03-19', NULL),
  ('show-016-ep-005', 'show-016', 5, 'Episode 5', TRUE, TRUE, '2026-03-26', NULL),
  ('show-016-ep-006', 'show-016', 6, 'Episode 6', TRUE, TRUE, '2026-04-02', NULL),
  ('show-016-ep-007', 'show-016', 7, 'Episode 7', TRUE, TRUE, '2026-04-09', NULL),
  ('show-016-ep-008', 'show-016', 8, 'Episode 8', TRUE, TRUE, '2026-04-16', NULL),
  ('show-016-ep-009', 'show-016', 9, 'Episode 9', TRUE, TRUE, '2026-04-23', NULL),
  ('show-016-ep-010', 'show-016', 10, 'Episode 10', TRUE, TRUE, '2026-04-30', NULL),
  ('show-016-ep-011', 'show-016', 11, 'Episode 11', TRUE, TRUE, '2026-05-07', NULL),
  ('show-016-ep-012', 'show-016', 12, 'Episode 12', TRUE, FALSE, '2026-05-14', NULL),
  ('show-016-ep-013', 'show-016', 13, 'Episode 13', TRUE, FALSE, '2026-05-21', NULL),
  ('show-017-ep-001', 'show-017', 1, 'Episode 1', TRUE, TRUE, '2026-02-26', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-017-ep-002', 'show-017', 2, 'Episode 2', TRUE, TRUE, '2026-03-05', NULL),
  ('show-017-ep-003', 'show-017', 3, 'Episode 3', TRUE, TRUE, '2026-03-12', NULL),
  ('show-017-ep-004', 'show-017', 4, 'Episode 4', TRUE, TRUE, '2026-03-19', NULL),
  ('show-017-ep-005', 'show-017', 5, 'Episode 5', TRUE, TRUE, '2026-03-26', NULL),
  ('show-017-ep-006', 'show-017', 6, 'Episode 6', TRUE, TRUE, '2026-04-02', NULL),
  ('show-017-ep-007', 'show-017', 7, 'Episode 7', TRUE, TRUE, '2026-04-09', NULL),
  ('show-017-ep-008', 'show-017', 8, 'Episode 8', TRUE, TRUE, '2026-04-16', NULL),
  ('show-017-ep-009', 'show-017', 9, 'Episode 9', TRUE, TRUE, '2026-04-23', NULL),
  ('show-017-ep-010', 'show-017', 10, 'Episode 10', TRUE, TRUE, '2026-04-30', NULL),
  ('show-017-ep-011', 'show-017', 11, 'Episode 11', TRUE, TRUE, '2026-05-07', NULL),
  ('show-017-ep-012', 'show-017', 12, 'Episode 12', TRUE, FALSE, '2026-05-14', NULL),
  ('show-017-ep-013', 'show-017', 13, 'Episode 13', TRUE, FALSE, '2026-05-21', NULL),
  ('show-018-ep-001', 'show-018', 1, 'Episode 1', TRUE, TRUE, '2026-03-14', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-018-ep-002', 'show-018', 2, 'Episode 2', TRUE, TRUE, '2026-03-21', NULL),
  ('show-018-ep-003', 'show-018', 3, 'Episode 3', TRUE, TRUE, '2026-03-28', NULL),
  ('show-018-ep-004', 'show-018', 4, 'Episode 4', TRUE, TRUE, '2026-04-04', NULL),
  ('show-018-ep-005', 'show-018', 5, 'Episode 5', TRUE, TRUE, '2026-04-11', NULL),
  ('show-018-ep-006', 'show-018', 6, 'Episode 6', TRUE, TRUE, '2026-04-18', NULL),
  ('show-018-ep-007', 'show-018', 7, 'Episode 7', TRUE, TRUE, '2026-04-25', NULL),
  ('show-018-ep-008', 'show-018', 8, 'Episode 8', TRUE, TRUE, '2026-05-02', NULL),
  ('show-018-ep-009', 'show-018', 9, 'Episode 9', TRUE, TRUE, '2026-05-09', NULL),
  ('show-018-ep-010', 'show-018', 10, 'Episode 10', TRUE, TRUE, '2026-05-16', NULL),
  ('show-018-ep-011', 'show-018', 11, 'Episode 11', TRUE, TRUE, '2026-05-23', NULL),
  ('show-018-ep-012', 'show-018', 12, 'Episode 12', TRUE, TRUE, '2026-05-30', NULL),
  ('show-018-ep-013', 'show-018', 13, 'Episode 13', TRUE, TRUE, '2026-06-06', NULL),
  ('show-019-ep-001', 'show-019', 1, 'Episode 1', TRUE, TRUE, '2025-12-30', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-019-ep-002', 'show-019', 2, 'Episode 2', TRUE, TRUE, '2026-01-06', NULL),
  ('show-019-ep-003', 'show-019', 3, 'Episode 3', TRUE, TRUE, '2026-01-13', NULL),
  ('show-019-ep-004', 'show-019', 4, 'Episode 4', TRUE, TRUE, '2026-01-20', NULL),
  ('show-019-ep-005', 'show-019', 5, 'Episode 5', TRUE, TRUE, '2026-01-27', NULL),
  ('show-019-ep-006', 'show-019', 6, 'Episode 6', TRUE, TRUE, '2026-02-03', NULL),
  ('show-019-ep-007', 'show-019', 7, 'Episode 7', TRUE, TRUE, '2026-02-10', NULL),
  ('show-019-ep-008', 'show-019', 8, 'Episode 8', TRUE, TRUE, '2026-02-17', NULL),
  ('show-019-ep-009', 'show-019', 9, 'Episode 9', TRUE, TRUE, '2026-02-24', NULL),
  ('show-019-ep-010', 'show-019', 10, 'Episode 10', TRUE, TRUE, '2026-03-03', NULL),
  ('show-019-ep-011', 'show-019', 11, 'Episode 11', TRUE, TRUE, '2026-03-10', NULL),
  ('show-019-ep-012', 'show-019', 12, 'Episode 12', TRUE, TRUE, '2026-03-17', NULL),
  ('show-019-ep-013', 'show-019', 13, 'Episode 13', TRUE, TRUE, '2026-03-24', NULL),
  ('show-019-ep-014', 'show-019', 14, 'Episode 14', TRUE, TRUE, '2026-03-31', NULL),
  ('show-019-ep-015', 'show-019', 15, 'Episode 15', TRUE, TRUE, '2026-04-07', NULL),
  ('show-019-ep-016', 'show-019', 16, 'Episode 16', TRUE, TRUE, '2026-04-14', NULL),
  ('show-019-ep-017', 'show-019', 17, 'Episode 17', TRUE, TRUE, '2026-04-21', NULL),
  ('show-019-ep-018', 'show-019', 18, 'Episode 18', TRUE, TRUE, '2026-04-28', NULL),
  ('show-019-ep-019', 'show-019', 19, 'Episode 19', TRUE, TRUE, '2026-05-05', NULL),
  ('show-019-ep-020', 'show-019', 20, 'Episode 20', TRUE, TRUE, '2026-05-12', NULL),
  ('show-019-ep-021', 'show-019', 21, 'Episode 21', TRUE, TRUE, '2026-05-19', NULL),
  ('show-019-ep-022', 'show-019', 22, 'Episode 22', TRUE, TRUE, '2026-05-26', NULL),
  ('show-019-ep-023', 'show-019', 23, 'Episode 23', TRUE, TRUE, '2026-06-02', NULL),
  ('show-019-ep-024', 'show-019', 24, 'Episode 24', TRUE, TRUE, '2026-06-09', NULL),
  ('show-020-ep-001', 'show-020', 1, 'Episode 1', TRUE, TRUE, '2025-12-09', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-020-ep-002', 'show-020', 2, 'Episode 2', TRUE, TRUE, '2025-12-16', NULL),
  ('show-020-ep-003', 'show-020', 3, 'Episode 3', TRUE, TRUE, '2025-12-23', NULL),
  ('show-020-ep-004', 'show-020', 4, 'Episode 4', TRUE, TRUE, '2025-12-30', NULL),
  ('show-020-ep-005', 'show-020', 5, 'Episode 5', TRUE, TRUE, '2026-01-06', NULL),
  ('show-020-ep-006', 'show-020', 6, 'Episode 6', TRUE, TRUE, '2026-01-13', NULL),
  ('show-020-ep-007', 'show-020', 7, 'Episode 7', TRUE, TRUE, '2026-01-20', NULL),
  ('show-020-ep-008', 'show-020', 8, 'Episode 8', TRUE, TRUE, '2026-01-27', NULL),
  ('show-020-ep-009', 'show-020', 9, 'Episode 9', TRUE, TRUE, '2026-02-03', NULL),
  ('show-020-ep-010', 'show-020', 10, 'Episode 10', TRUE, TRUE, '2026-02-10', NULL),
  ('show-020-ep-011', 'show-020', 11, 'Episode 11', TRUE, TRUE, '2026-02-17', NULL),
  ('show-020-ep-012', 'show-020', 12, 'Episode 12', TRUE, TRUE, '2026-02-24', NULL),
  ('show-020-ep-013', 'show-020', 13, 'Episode 13', TRUE, TRUE, '2026-03-03', NULL),
  ('show-020-ep-014', 'show-020', 14, 'Episode 14', TRUE, TRUE, '2026-03-10', NULL),
  ('show-020-ep-015', 'show-020', 15, 'Episode 15', TRUE, TRUE, '2026-03-17', NULL),
  ('show-020-ep-016', 'show-020', 16, 'Episode 16', TRUE, TRUE, '2026-03-24', NULL),
  ('show-020-ep-017', 'show-020', 17, 'Episode 17', TRUE, TRUE, '2026-03-31', NULL),
  ('show-020-ep-018', 'show-020', 18, 'Episode 18', TRUE, TRUE, '2026-04-07', NULL),
  ('show-020-ep-019', 'show-020', 19, 'Episode 19', TRUE, TRUE, '2026-04-14', NULL),
  ('show-020-ep-020', 'show-020', 20, 'Episode 20', TRUE, TRUE, '2026-04-21', NULL),
  ('show-020-ep-021', 'show-020', 21, 'Episode 21', TRUE, TRUE, '2026-04-28', NULL),
  ('show-020-ep-022', 'show-020', 22, 'Episode 22', TRUE, TRUE, '2026-05-05', NULL),
  ('show-020-ep-023', 'show-020', 23, 'Episode 23', TRUE, TRUE, '2026-05-12', NULL),
  ('show-020-ep-024', 'show-020', 24, 'Episode 24', TRUE, TRUE, '2026-05-19', NULL),
  ('show-020-ep-025', 'show-020', 25, 'Episode 25', TRUE, TRUE, '2026-05-26', NULL),
  ('show-020-ep-026', 'show-020', 26, 'Episode 26', TRUE, TRUE, '2026-06-02', NULL),
  ('show-021-ep-001', 'show-021', 1, 'Episode 1', TRUE, TRUE, '2026-05-28', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-022-ep-001', 'show-022', 1, 'Episode 1', TRUE, TRUE, '2025-12-16', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-022-ep-002', 'show-022', 2, 'Episode 2', TRUE, TRUE, '2025-12-23', NULL),
  ('show-022-ep-003', 'show-022', 3, 'Episode 3', TRUE, TRUE, '2025-12-30', NULL),
  ('show-022-ep-004', 'show-022', 4, 'Episode 4', TRUE, TRUE, '2026-01-06', NULL),
  ('show-022-ep-005', 'show-022', 5, 'Episode 5', TRUE, TRUE, '2026-01-13', NULL),
  ('show-022-ep-006', 'show-022', 6, 'Episode 6', TRUE, TRUE, '2026-01-20', NULL),
  ('show-022-ep-007', 'show-022', 7, 'Episode 7', TRUE, TRUE, '2026-01-27', NULL),
  ('show-022-ep-008', 'show-022', 8, 'Episode 8', TRUE, TRUE, '2026-02-03', NULL),
  ('show-022-ep-009', 'show-022', 9, 'Episode 9', TRUE, TRUE, '2026-02-10', NULL),
  ('show-022-ep-010', 'show-022', 10, 'Episode 10', TRUE, TRUE, '2026-02-17', NULL),
  ('show-022-ep-011', 'show-022', 11, 'Episode 11', TRUE, TRUE, '2026-02-24', NULL),
  ('show-022-ep-012', 'show-022', 12, 'Episode 12', TRUE, TRUE, '2026-03-03', NULL),
  ('show-022-ep-013', 'show-022', 13, 'Episode 13', TRUE, TRUE, '2026-03-10', NULL),
  ('show-022-ep-014', 'show-022', 14, 'Episode 14', TRUE, TRUE, '2026-03-17', NULL),
  ('show-022-ep-015', 'show-022', 15, 'Episode 15', TRUE, TRUE, '2026-03-24', NULL),
  ('show-022-ep-016', 'show-022', 16, 'Episode 16', TRUE, TRUE, '2026-03-31', NULL),
  ('show-022-ep-017', 'show-022', 17, 'Episode 17', TRUE, TRUE, '2026-04-07', NULL),
  ('show-022-ep-018', 'show-022', 18, 'Episode 18', TRUE, TRUE, '2026-04-14', NULL),
  ('show-022-ep-019', 'show-022', 19, 'Episode 19', TRUE, TRUE, '2026-04-21', NULL),
  ('show-022-ep-020', 'show-022', 20, 'Episode 20', TRUE, TRUE, '2026-04-28', NULL),
  ('show-022-ep-021', 'show-022', 21, 'Episode 21', TRUE, TRUE, '2026-05-05', NULL),
  ('show-022-ep-022', 'show-022', 22, 'Episode 22', TRUE, TRUE, '2026-05-12', NULL),
  ('show-022-ep-023', 'show-022', 23, 'Episode 23', TRUE, TRUE, '2026-05-19', NULL),
  ('show-022-ep-024', 'show-022', 24, 'Episode 24', TRUE, TRUE, '2026-05-26', NULL),
  ('show-022-ep-025', 'show-022', 25, 'Episode 25', TRUE, TRUE, '2026-06-02', NULL),
  ('show-023-ep-001', 'show-023', 1, 'Episode 1', TRUE, TRUE, '2025-12-24', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-023-ep-002', 'show-023', 2, 'Episode 2', TRUE, TRUE, '2025-12-31', NULL),
  ('show-023-ep-003', 'show-023', 3, 'Episode 3', TRUE, TRUE, '2026-01-07', NULL),
  ('show-023-ep-004', 'show-023', 4, 'Episode 4', TRUE, TRUE, '2026-01-14', NULL),
  ('show-023-ep-005', 'show-023', 5, 'Episode 5', TRUE, TRUE, '2026-01-21', NULL),
  ('show-023-ep-006', 'show-023', 6, 'Episode 6', TRUE, TRUE, '2026-01-28', NULL),
  ('show-023-ep-007', 'show-023', 7, 'Episode 7', TRUE, TRUE, '2026-02-04', NULL),
  ('show-023-ep-008', 'show-023', 8, 'Episode 8', TRUE, TRUE, '2026-02-11', NULL),
  ('show-023-ep-009', 'show-023', 9, 'Episode 9', TRUE, FALSE, '2026-02-18', NULL),
  ('show-023-ep-010', 'show-023', 10, 'Episode 10', TRUE, FALSE, '2026-02-25', NULL),
  ('show-023-ep-011', 'show-023', 11, 'Episode 11', TRUE, FALSE, '2026-03-04', NULL),
  ('show-023-ep-012', 'show-023', 12, 'Episode 12', TRUE, FALSE, '2026-03-11', NULL),
  ('show-023-ep-013', 'show-023', 13, 'Episode 13', TRUE, FALSE, '2026-03-18', NULL),
  ('show-023-ep-014', 'show-023', 14, 'Episode 14', TRUE, FALSE, '2026-03-25', NULL),
  ('show-023-ep-015', 'show-023', 15, 'Episode 15', TRUE, FALSE, '2026-04-01', NULL),
  ('show-023-ep-016', 'show-023', 16, 'Episode 16', TRUE, FALSE, '2026-04-08', NULL),
  ('show-023-ep-017', 'show-023', 17, 'Episode 17', TRUE, FALSE, '2026-04-15', NULL),
  ('show-023-ep-018', 'show-023', 18, 'Episode 18', TRUE, FALSE, '2026-04-22', NULL),
  ('show-023-ep-019', 'show-023', 19, 'Episode 19', TRUE, FALSE, '2026-04-29', NULL),
  ('show-023-ep-020', 'show-023', 20, 'Episode 20', TRUE, FALSE, '2026-05-06', NULL),
  ('show-023-ep-021', 'show-023', 21, 'Episode 21', TRUE, FALSE, '2026-05-13', NULL),
  ('show-023-ep-022', 'show-023', 22, 'Episode 22', TRUE, FALSE, '2026-05-20', NULL),
  ('show-023-ep-023', 'show-023', 23, 'Episode 23', TRUE, FALSE, '2026-05-27', NULL),
  ('show-023-ep-024', 'show-023', 24, 'Episode 24', TRUE, FALSE, '2026-06-03', NULL),
  ('show-024-ep-001', 'show-024', 1, 'Episode 1', TRUE, TRUE, '2026-01-06', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-024-ep-002', 'show-024', 2, 'Episode 2', TRUE, TRUE, '2026-01-13', NULL),
  ('show-024-ep-003', 'show-024', 3, 'Episode 3', TRUE, TRUE, '2026-01-20', NULL),
  ('show-024-ep-004', 'show-024', 4, 'Episode 4', TRUE, TRUE, '2026-01-27', NULL),
  ('show-024-ep-005', 'show-024', 5, 'Episode 5', TRUE, TRUE, '2026-02-03', NULL),
  ('show-024-ep-006', 'show-024', 6, 'Episode 6', TRUE, TRUE, '2026-02-10', NULL),
  ('show-024-ep-007', 'show-024', 7, 'Episode 7', TRUE, TRUE, '2026-02-17', NULL),
  ('show-024-ep-008', 'show-024', 8, 'Episode 8', TRUE, TRUE, '2026-02-24', NULL),
  ('show-024-ep-009', 'show-024', 9, 'Episode 9', TRUE, TRUE, '2026-03-03', NULL),
  ('show-024-ep-010', 'show-024', 10, 'Episode 10', TRUE, TRUE, '2026-03-10', NULL),
  ('show-024-ep-011', 'show-024', 11, 'Episode 11', TRUE, TRUE, '2026-03-17', NULL),
  ('show-024-ep-012', 'show-024', 12, 'Episode 12', TRUE, TRUE, '2026-03-24', NULL),
  ('show-024-ep-013', 'show-024', 13, 'Episode 13', TRUE, TRUE, '2026-03-31', NULL),
  ('show-024-ep-014', 'show-024', 14, 'Episode 14', TRUE, TRUE, '2026-04-07', NULL),
  ('show-024-ep-015', 'show-024', 15, 'Episode 15', TRUE, TRUE, '2026-04-14', NULL),
  ('show-024-ep-016', 'show-024', 16, 'Episode 16', TRUE, TRUE, '2026-04-21', NULL),
  ('show-024-ep-017', 'show-024', 17, 'Episode 17', TRUE, TRUE, '2026-04-28', NULL),
  ('show-024-ep-018', 'show-024', 18, 'Episode 18', TRUE, TRUE, '2026-05-05', NULL),
  ('show-024-ep-019', 'show-024', 19, 'Episode 19', TRUE, TRUE, '2026-05-12', NULL),
  ('show-024-ep-020', 'show-024', 20, 'Episode 20', TRUE, TRUE, '2026-05-19', NULL),
  ('show-024-ep-021', 'show-024', 21, 'Episode 21', TRUE, TRUE, '2026-05-26', NULL),
  ('show-024-ep-022', 'show-024', 22, 'Episode 22', TRUE, TRUE, '2026-06-02', NULL),
('show-025-ep-001', 'show-025', 1, 'Episode 1', TRUE, FALSE, '2026-04-06', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-025-ep-002', 'show-025', 2, 'Episode 2', TRUE, FALSE, '2026-04-13', NULL),
  ('show-025-ep-003', 'show-025', 3, 'Episode 3', TRUE, FALSE, '2026-04-20', NULL),
  ('show-025-ep-004', 'show-025', 4, 'Episode 4', TRUE, FALSE, '2026-04-27', NULL),
  ('show-025-ep-005', 'show-025', 5, 'Episode 5', TRUE, FALSE, '2026-05-04', NULL),
  ('show-025-ep-006', 'show-025', 6, 'Episode 6', TRUE, FALSE, '2026-05-11', NULL),
  ('show-025-ep-007', 'show-025', 7, 'Episode 7', TRUE, FALSE, '2026-05-18', NULL),
  ('show-025-ep-008', 'show-025', 8, 'Episode 8', TRUE, FALSE, '2026-05-25', NULL),
  ('show-025-ep-009', 'show-025', 9, 'Episode 9', TRUE, FALSE, '2026-06-01', NULL),
  ('show-025-ep-010', 'show-025', 10, 'Episode 10', TRUE, FALSE, '2026-06-08', NULL),
  ('show-025-ep-011', 'show-025', 11, 'Episode 11', TRUE, FALSE, '2026-06-15', NULL),
  ('show-026-ep-001', 'show-026', 1, 'Episode 1', TRUE, FALSE, '2026-04-01', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-026-ep-002', 'show-026', 2, 'Episode 2', TRUE, FALSE, '2026-04-08', NULL),
  ('show-026-ep-003', 'show-026', 3, 'Episode 3', TRUE, FALSE, '2026-04-15', NULL),
  ('show-026-ep-004', 'show-026', 4, 'Episode 4', TRUE, FALSE, '2026-04-22', NULL),
  ('show-026-ep-005', 'show-026', 5, 'Episode 5', TRUE, FALSE, '2026-04-29', NULL),
  ('show-026-ep-006', 'show-026', 6, 'Episode 6', TRUE, FALSE, '2026-05-06', NULL),
  ('show-026-ep-007', 'show-026', 7, 'Episode 7', TRUE, FALSE, '2026-05-13', NULL),
  ('show-026-ep-008', 'show-026', 8, 'Episode 8', TRUE, FALSE, '2026-05-20', NULL),
  ('show-026-ep-009', 'show-026', 9, 'Episode 9', TRUE, FALSE, '2026-05-27', NULL),
  ('show-026-ep-010', 'show-026', 10, 'Episode 10', TRUE, FALSE, '2026-06-03', NULL),
  ('show-026-ep-011', 'show-026', 11, 'Episode 11', TRUE, FALSE, '2026-06-10', NULL),
  ('show-027-ep-001', 'show-027', 1, 'Episode 1', TRUE, FALSE, '2026-04-03', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-027-ep-002', 'show-027', 2, 'Episode 2', TRUE, FALSE, '2026-04-10', NULL),
  ('show-027-ep-003', 'show-027', 3, 'Episode 3', TRUE, FALSE, '2026-04-17', NULL),
  ('show-027-ep-004', 'show-027', 4, 'Episode 4', TRUE, FALSE, '2026-04-24', NULL),
  ('show-027-ep-005', 'show-027', 5, 'Episode 5', TRUE, FALSE, '2026-05-01', NULL),
  ('show-027-ep-006', 'show-027', 6, 'Episode 6', TRUE, FALSE, '2026-05-08', NULL),
  ('show-027-ep-007', 'show-027', 7, 'Episode 7', TRUE, FALSE, '2026-05-15', NULL),
  ('show-027-ep-008', 'show-027', 8, 'Episode 8', TRUE, FALSE, '2026-05-22', NULL),
  ('show-027-ep-009', 'show-027', 9, 'Episode 9', TRUE, FALSE, '2026-05-29', NULL),
  ('show-027-ep-010', 'show-027', 10, 'Episode 10', TRUE, FALSE, '2026-06-05', NULL),
  ('show-027-ep-011', 'show-027', 11, 'Episode 11', TRUE, FALSE, '2026-06-12', NULL),
  ('show-028-ep-001', 'show-028', 1, 'Episode 1', TRUE, FALSE, '2026-04-04', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-028-ep-002', 'show-028', 2, 'Episode 2', TRUE, FALSE, '2026-04-11', NULL),
  ('show-028-ep-003', 'show-028', 3, 'Episode 3', TRUE, FALSE, '2026-04-18', NULL),
  ('show-028-ep-004', 'show-028', 4, 'Episode 4', TRUE, FALSE, '2026-04-25', NULL),
  ('show-028-ep-005', 'show-028', 5, 'Episode 5', TRUE, FALSE, '2026-05-02', NULL),
  ('show-028-ep-006', 'show-028', 6, 'Episode 6', TRUE, FALSE, '2026-05-09', NULL),
  ('show-028-ep-007', 'show-028', 7, 'Episode 7', TRUE, FALSE, '2026-05-16', NULL),
  ('show-028-ep-008', 'show-028', 8, 'Episode 8', TRUE, FALSE, '2026-05-23', NULL),
  ('show-028-ep-009', 'show-028', 9, 'Episode 9', TRUE, FALSE, '2026-05-30', NULL),
  ('show-028-ep-010', 'show-028', 10, 'Episode 10', TRUE, FALSE, '2026-06-06', NULL),
  ('show-028-ep-011', 'show-028', 11, 'Episode 11', TRUE, FALSE, '2026-06-13', NULL),
  ('show-029-ep-001', 'show-029', 1, 'Episode 1', TRUE, FALSE, '2026-04-12', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-029-ep-002', 'show-029', 2, 'Episode 2', TRUE, FALSE, '2026-04-19', NULL),
  ('show-029-ep-003', 'show-029', 3, 'Episode 3', TRUE, FALSE, '2026-04-26', NULL),
  ('show-029-ep-004', 'show-029', 4, 'Episode 4', TRUE, FALSE, '2026-05-03', NULL),
  ('show-029-ep-005', 'show-029', 5, 'Episode 5', TRUE, FALSE, '2026-05-10', NULL),
  ('show-029-ep-006', 'show-029', 6, 'Episode 6', TRUE, FALSE, '2026-05-17', NULL),
  ('show-029-ep-007', 'show-029', 7, 'Episode 7', TRUE, FALSE, '2026-05-24', NULL),
  ('show-029-ep-008', 'show-029', 8, 'Episode 8', TRUE, FALSE, '2026-05-31', NULL),
  ('show-029-ep-009', 'show-029', 9, 'Episode 9', TRUE, FALSE, '2026-06-07', NULL),
  ('show-029-ep-010', 'show-029', 10, 'Episode 10', TRUE, FALSE, '2026-06-14', NULL),
  ('show-030-ep-001', 'show-030', 1, 'Episode 1', TRUE, FALSE, '2026-04-02', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-030-ep-002', 'show-030', 2, 'Episode 2', TRUE, FALSE, '2026-04-09', NULL),
  ('show-030-ep-003', 'show-030', 3, 'Episode 3', TRUE, FALSE, '2026-04-16', NULL),
  ('show-030-ep-004', 'show-030', 4, 'Episode 4', TRUE, FALSE, '2026-04-23', NULL),
  ('show-030-ep-005', 'show-030', 5, 'Episode 5', TRUE, FALSE, '2026-04-30', NULL),
  ('show-030-ep-006', 'show-030', 6, 'Episode 6', TRUE, FALSE, '2026-05-07', NULL),
  ('show-030-ep-007', 'show-030', 7, 'Episode 7', TRUE, FALSE, '2026-05-14', NULL),
  ('show-030-ep-008', 'show-030', 8, 'Episode 8', TRUE, FALSE, '2026-05-21', NULL),
  ('show-030-ep-009', 'show-030', 9, 'Episode 9', TRUE, FALSE, '2026-05-28', NULL),
  ('show-030-ep-010', 'show-030', 10, 'Episode 10', TRUE, FALSE, '2026-06-04', NULL),
  ('show-030-ep-011', 'show-030', 11, 'Episode 11', TRUE, FALSE, '2026-06-11', NULL),
  ('show-031-ep-001', 'show-031', 1, 'Episode 1', TRUE, FALSE, '2026-04-03', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-031-ep-002', 'show-031', 2, 'Episode 2', TRUE, FALSE, '2026-04-10', NULL),
  ('show-031-ep-003', 'show-031', 3, 'Episode 3', TRUE, FALSE, '2026-04-17', NULL),
  ('show-031-ep-004', 'show-031', 4, 'Episode 4', TRUE, FALSE, '2026-04-24', NULL),
  ('show-031-ep-005', 'show-031', 5, 'Episode 5', TRUE, FALSE, '2026-05-01', NULL),
  ('show-031-ep-006', 'show-031', 6, 'Episode 6', TRUE, FALSE, '2026-05-08', NULL),
  ('show-031-ep-007', 'show-031', 7, 'Episode 7', TRUE, FALSE, '2026-05-15', NULL),
  ('show-031-ep-008', 'show-031', 8, 'Episode 8', TRUE, FALSE, '2026-05-22', NULL),
  ('show-031-ep-009', 'show-031', 9, 'Episode 9', TRUE, FALSE, '2026-05-29', NULL),
  ('show-031-ep-010', 'show-031', 10, 'Episode 10', TRUE, FALSE, '2026-06-05', NULL),
  ('show-031-ep-011', 'show-031', 11, 'Episode 11', TRUE, FALSE, '2026-06-12', NULL),
  ('show-032-ep-001', 'show-032', 1, 'Episode 1', TRUE, FALSE, '2026-04-07', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-032-ep-002', 'show-032', 2, 'Episode 2', TRUE, FALSE, '2026-04-14', NULL),
  ('show-032-ep-003', 'show-032', 3, 'Episode 3', TRUE, FALSE, '2026-04-21', NULL),
  ('show-032-ep-004', 'show-032', 4, 'Episode 4', TRUE, FALSE, '2026-04-28', NULL),
  ('show-032-ep-005', 'show-032', 5, 'Episode 5', TRUE, FALSE, '2026-05-05', NULL),
  ('show-032-ep-006', 'show-032', 6, 'Episode 6', TRUE, FALSE, '2026-05-12', NULL),
  ('show-032-ep-007', 'show-032', 7, 'Episode 7', TRUE, FALSE, '2026-05-19', NULL),
  ('show-032-ep-008', 'show-032', 8, 'Episode 8', TRUE, FALSE, '2026-05-26', NULL),
  ('show-032-ep-009', 'show-032', 9, 'Episode 9', TRUE, FALSE, '2026-06-02', NULL),
  ('show-032-ep-010', 'show-032', 10, 'Episode 10', TRUE, FALSE, '2026-06-09', NULL),
  ('show-033-ep-001', 'show-033', 1, 'Episode 1', TRUE, FALSE, '2026-04-08', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-033-ep-002', 'show-033', 2, 'Episode 2', TRUE, FALSE, '2026-04-15', NULL),
  ('show-033-ep-003', 'show-033', 3, 'Episode 3', TRUE, FALSE, '2026-04-22', NULL),
  ('show-033-ep-004', 'show-033', 4, 'Episode 4', TRUE, FALSE, '2026-04-29', NULL),
  ('show-033-ep-005', 'show-033', 5, 'Episode 5', TRUE, FALSE, '2026-05-06', NULL),
  ('show-033-ep-006', 'show-033', 6, 'Episode 6', TRUE, FALSE, '2026-05-13', NULL),
  ('show-033-ep-007', 'show-033', 7, 'Episode 7', TRUE, FALSE, '2026-05-20', NULL),
  ('show-033-ep-008', 'show-033', 8, 'Episode 8', TRUE, FALSE, '2026-05-27', NULL),
  ('show-033-ep-009', 'show-033', 9, 'Episode 9', TRUE, FALSE, '2026-06-03', NULL),
  ('show-033-ep-010', 'show-033', 10, 'Episode 10', TRUE, FALSE, '2026-06-10', NULL),
  ('show-034-ep-001', 'show-034', 1, 'Episode 1', TRUE, FALSE, '2026-04-09', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-034-ep-002', 'show-034', 2, 'Episode 2', TRUE, FALSE, '2026-04-16', NULL),
  ('show-034-ep-003', 'show-034', 3, 'Episode 3', TRUE, FALSE, '2026-04-23', NULL),
  ('show-034-ep-004', 'show-034', 4, 'Episode 4', TRUE, FALSE, '2026-04-30', NULL),
  ('show-034-ep-005', 'show-034', 5, 'Episode 5', TRUE, FALSE, '2026-05-07', NULL),
  ('show-034-ep-006', 'show-034', 6, 'Episode 6', TRUE, FALSE, '2026-05-14', NULL),
  ('show-034-ep-007', 'show-034', 7, 'Episode 7', TRUE, FALSE, '2026-05-21', NULL),
  ('show-034-ep-008', 'show-034', 8, 'Episode 8', TRUE, FALSE, '2026-05-28', NULL),
  ('show-034-ep-009', 'show-034', 9, 'Episode 9', TRUE, FALSE, '2026-06-04', NULL),
  ('show-034-ep-010', 'show-034', 10, 'Episode 10', TRUE, FALSE, '2026-06-11', NULL),
  ('show-035-ep-001', 'show-035', 1, 'Episode 1', TRUE, FALSE, '2026-04-04', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-035-ep-002', 'show-035', 2, 'Episode 2', TRUE, FALSE, '2026-04-11', NULL),
  ('show-035-ep-003', 'show-035', 3, 'Episode 3', TRUE, FALSE, '2026-04-18', NULL),
  ('show-035-ep-004', 'show-035', 4, 'Episode 4', TRUE, FALSE, '2026-04-25', NULL),
  ('show-035-ep-005', 'show-035', 5, 'Episode 5', TRUE, FALSE, '2026-05-02', NULL),
  ('show-035-ep-006', 'show-035', 6, 'Episode 6', TRUE, FALSE, '2026-05-09', NULL),
  ('show-035-ep-007', 'show-035', 7, 'Episode 7', TRUE, FALSE, '2026-05-16', NULL),
  ('show-035-ep-008', 'show-035', 8, 'Episode 8', TRUE, FALSE, '2026-05-23', NULL),
  ('show-035-ep-009', 'show-035', 9, 'Episode 9', TRUE, FALSE, '2026-05-30', NULL),
  ('show-035-ep-010', 'show-035', 10, 'Episode 10', TRUE, FALSE, '2026-06-06', NULL),
  ('show-035-ep-011', 'show-035', 11, 'Episode 11', TRUE, FALSE, '2026-06-13', NULL),
  ('show-036-ep-001', 'show-036', 1, 'Episode 1', TRUE, FALSE, '2026-04-06', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-036-ep-002', 'show-036', 2, 'Episode 2', TRUE, FALSE, '2026-04-13', NULL),
  ('show-036-ep-003', 'show-036', 3, 'Episode 3', TRUE, FALSE, '2026-04-20', NULL),
  ('show-036-ep-004', 'show-036', 4, 'Episode 4', TRUE, FALSE, '2026-04-27', NULL),
  ('show-036-ep-005', 'show-036', 5, 'Episode 5', TRUE, FALSE, '2026-05-04', NULL),
  ('show-036-ep-006', 'show-036', 6, 'Episode 6', TRUE, FALSE, '2026-05-11', NULL),
  ('show-036-ep-007', 'show-036', 7, 'Episode 7', TRUE, FALSE, '2026-05-18', NULL),
  ('show-036-ep-008', 'show-036', 8, 'Episode 8', TRUE, FALSE, '2026-05-25', NULL),
  ('show-036-ep-009', 'show-036', 9, 'Episode 9', TRUE, FALSE, '2026-06-01', NULL),
  ('show-036-ep-010', 'show-036', 10, 'Episode 10', TRUE, FALSE, '2026-06-08', NULL),
  ('show-036-ep-011', 'show-036', 11, 'Episode 11', TRUE, FALSE, '2026-06-15', NULL),
  ('show-037-ep-001', 'show-037', 1, 'Episode 1', TRUE, FALSE, '2026-04-01', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-037-ep-002', 'show-037', 2, 'Episode 2', TRUE, FALSE, '2026-04-08', NULL),
  ('show-037-ep-003', 'show-037', 3, 'Episode 3', TRUE, FALSE, '2026-04-15', NULL),
  ('show-037-ep-004', 'show-037', 4, 'Episode 4', TRUE, FALSE, '2026-04-22', NULL),
  ('show-037-ep-005', 'show-037', 5, 'Episode 5', TRUE, FALSE, '2026-04-29', NULL),
  ('show-037-ep-006', 'show-037', 6, 'Episode 6', TRUE, FALSE, '2026-05-06', NULL),
  ('show-037-ep-007', 'show-037', 7, 'Episode 7', TRUE, FALSE, '2026-05-13', NULL),
  ('show-037-ep-008', 'show-037', 8, 'Episode 8', TRUE, FALSE, '2026-05-20', NULL),
  ('show-037-ep-009', 'show-037', 9, 'Episode 9', TRUE, FALSE, '2026-05-27', NULL),
  ('show-037-ep-010', 'show-037', 10, 'Episode 10', TRUE, FALSE, '2026-06-03', NULL),
  ('show-037-ep-011', 'show-037', 11, 'Episode 11', TRUE, FALSE, '2026-06-10', NULL),
  ('show-038-ep-001', 'show-038', 1, 'Episode 1', TRUE, FALSE, '2026-04-04', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-038-ep-002', 'show-038', 2, 'Episode 2', TRUE, FALSE, '2026-04-11', NULL),
  ('show-038-ep-003', 'show-038', 3, 'Episode 3', TRUE, FALSE, '2026-04-18', NULL),
  ('show-038-ep-004', 'show-038', 4, 'Episode 4', TRUE, FALSE, '2026-04-25', NULL),
  ('show-038-ep-005', 'show-038', 5, 'Episode 5', TRUE, FALSE, '2026-05-02', NULL),
  ('show-038-ep-006', 'show-038', 6, 'Episode 6', TRUE, FALSE, '2026-05-09', NULL),
  ('show-038-ep-007', 'show-038', 7, 'Episode 7', TRUE, FALSE, '2026-05-16', NULL),
  ('show-038-ep-008', 'show-038', 8, 'Episode 8', TRUE, FALSE, '2026-05-23', NULL),
  ('show-038-ep-009', 'show-038', 9, 'Episode 9', TRUE, FALSE, '2026-05-30', NULL),
  ('show-038-ep-010', 'show-038', 10, 'Episode 10', TRUE, FALSE, '2026-06-06', NULL),
  ('show-038-ep-011', 'show-038', 11, 'Episode 11', TRUE, FALSE, '2026-06-13', NULL),
  ('show-039-ep-001', 'show-039', 1, 'Episode 1', TRUE, FALSE, '2026-04-04', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
  ('show-039-ep-002', 'show-039', 2, 'Episode 2', TRUE, FALSE, '2026-04-11', NULL),
  ('show-039-ep-003', 'show-039', 3, 'Episode 3', TRUE, FALSE, '2026-04-18', NULL),
  ('show-039-ep-004', 'show-039', 4, 'Episode 4', TRUE, FALSE, '2026-04-25', NULL),
  ('show-039-ep-005', 'show-039', 5, 'Episode 5', TRUE, FALSE, '2026-05-02', NULL),
  ('show-039-ep-006', 'show-039', 6, 'Episode 6', TRUE, FALSE, '2026-05-09', NULL),
  ('show-039-ep-007', 'show-039', 7, 'Episode 7', TRUE, FALSE, '2026-05-16', NULL),
  ('show-039-ep-008', 'show-039', 8, 'Episode 8', TRUE, FALSE, '2026-05-23', NULL),
  ('show-039-ep-009', 'show-039', 9, 'Episode 9', TRUE, FALSE, '2026-05-30', NULL),
  ('show-039-ep-010', 'show-039', 10, 'Episode 10', TRUE, FALSE, '2026-06-06', NULL),
  ('show-039-ep-011', 'show-039', 11, 'Episode 11', TRUE, FALSE, '2026-06-13', NULL);

-- airing_slots ------------------------------------------------------------
-- Milestone 2: one weekly air slot per currently-airing show (JST source).
-- day_of_week: 0=Monday … 6=Sunday. air_time: 'HH:MM' 24h.
-- FK-safe: shows rows already inserted above.
insert into public.airing_slots (id, show_id, day_of_week, air_time, timezone, season) values
  ('slot-001', 'show-002', 5, '17:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-002', 'show-009', 2, '23:00', 'Asia/Tokyo', 'Spring 2026'),
('slot-003', 'show-025', 0, '23:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-004', 'show-026', 0, '00:30', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-005', 'show-027', 1, '22:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-006', 'show-028', 1, '12:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-007', 'show-029', 2, '23:30', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-008', 'show-030', 2, '08:30', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-009', 'show-031', 3, '21:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-010', 'show-032', 3, '01:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-011', 'show-033', 4, '22:30', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-012', 'show-034', 4, '10:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-013', 'show-035', 5, '17:30', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-014', 'show-036', 5, '00:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-015', 'show-037', 6, '23:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-016', 'show-038', 6, '16:00', 'Asia/Tokyo', 'Spring 2026'),
  ('slot-017', 'show-039', 6, '09:30', 'Asia/Tokyo', 'Spring 2026');

-- forum_categories --------------------------------------------------------
-- Milestone 3, Feature 3 (FORUM): a fixed set of public discussion areas.
-- Seed-only (no client write path); stable text ids. Idempotent upsert so
-- `npx supabase db reset` re-seeds cleanly without a truncate (forum_threads /
-- forum_posts cascade off auth.users, which db reset wipes separately).
insert into public.forum_categories (id, name, slug, description, sort_order) values
  ('cat-general',         'General Discussion', 'general-discussion', 'Talk about anything anime — news, hot takes, and everything in between.', 1),
  ('cat-seasonal',        'Seasonal Anime',     'seasonal-anime',     'Discuss the currently-airing season: episode reactions, weekly threads, and standouts.', 2),
  ('cat-recommendations', 'Recommendations',    'recommendations',    'Ask for and share recommendations — find your next watch.', 3),
  ('cat-feedback',        'Site Feedback',      'site-feedback',      'Bugs, feature requests, and feedback about the site itself.', 4)
on conflict (id) do update set
  name        = excluded.name,
  slug        = excluded.slug,
  description = excluded.description,
  sort_order  = excluded.sort_order;

commit;
