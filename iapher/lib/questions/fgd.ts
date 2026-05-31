import type { Lang } from './bank'

export interface FGDProbe {
  en: string
  kh: string
  ga: string
  pn: string
}

export interface FGDQuestion {
  id: string
  section: string
  sectionColor: string
  mainQuestion: Record<Lang, string>
  probes: FGDProbe[]
  facilitatorNote: string
}

export const FGD_QUESTIONS: FGDQuestion[] = [
  {
    id: 'fgd_opening_1',
    section: 'opening',
    sectionColor: '#3b82f6',
    mainQuestion: {
      en: 'Let us start by introducing ourselves. Can you each share your name, where you are from, and one thing you enjoy doing?',
      kh: 'Ngin pynmih ia jin. Phi ia phi — u/ka mynsiem jong phi, hamar phi wan, bad kano ka jingshym phi jooh?',
      ga: 'Ngin pynmih. Aro ngi ong — nimina, hadei ngi wan, bad baksa ngi jooh?',
      pn: 'Ngin pynmih ia jin. Phi ia phi — u/ka mynsiem jong phi, hamar phi wan, bad kano ka jingshym phi jooh?',
    },
    probes: [
      {
        en: 'What brought you here today?',
        kh: 'Dei noh pynmih ia phi ban wan ha mynta?',
        ga: 'Dei noh pynmih ia ngi ban wan mynta?',
        pn: 'Dei noh pynmih ia phi ban wan ha mynta?',
      },
      {
        en: 'Have you participated in a discussion like this before?',
        kh: 'Phi la klam ha jingkrehkynmaw kumne pat?',
        ga: 'Ngi la klam ha discussion kumne pat?',
        pn: 'Phi la klam ha jingkrehkynmaw kumne pat?',
      },
    ],
    facilitatorNote:
      'Use this to warm up the group. Observe who takes up space and who holds back. Note any existing social hierarchies.',
  },
  {
    id: 'fgd_daily_1',
    section: 'daily_life',
    sectionColor: '#10b981',
    mainQuestion: {
      en: 'Think about a typical week in your life. What does it look like — from when you wake up to when you sleep?',
      kh: 'Tip ia u synshar biang ha jingim jong phi. Kumno phi ïoh la — haduh phi pang sha phi iap?',
      ga: 'Tip ia u synshar biang ha jongngi. Kumno ngi ong — da ngi pang sha ngi iap?',
      pn: 'Tip ia u synshar biang ha jingim jong phi. Kumno phi ïoh la — haduh phi pang sha phi iap?',
    },
    probes: [
      {
        en: 'What takes up most of your time and energy?',
        kh: 'Dei noh shim biang u sumar bad u jingpynshlur jong phi?',
        ga: 'Dei noh shim biang u time bad energy jongngi?',
        pn: 'Dei noh shim biang u sumar bad u jingpynshlur jong phi?',
      },
      {
        en: 'What do you look forward to? What do you dread?',
        kh: 'Dei noh phi jingmut ban ïoh? Dei noh phi tip bait?',
        ga: 'Dei noh ngi jingmut ban ïoh? Dei noh ngi tip bait?',
        pn: 'Dei noh phi jingmut ban ïoh? Dei noh phi tip bait?',
      },
      {
        en: 'How does your family see your role and responsibilities?',
        kh: 'Kur kha jong phi tip ia u jingshym jong phi kumno?',
        ga: 'Kur kha jongngi ong ia role jongngi kumno?',
        pn: 'Kur kha jong phi tip ia u jingshym jong phi kumno?',
      },
    ],
    facilitatorNote:
      'Listen for: gender differences in daily burdens, unpaid care work, pressure from family expectations, time poverty.',
  },
  {
    id: 'fgd_work_1',
    section: 'work_future',
    sectionColor: '#f59e0b',
    mainQuestion: {
      en: 'When you imagine your life five years from now, what do you see? What are you hoping for and what worries you?',
      kh: 'Lada phi tip ia jingim jong phi ha 5 snem kynmaw, phi ïoh kumno? Dei noh phi jingmut ban ïoh bad dei noh phi burom?',
      ga: 'Lada ngi tip ia jongngi ha 5 snem kynmaw, ngi ong kumno? Dei noh ngi jingmut bad dei noh ngi burom?',
      pn: 'Lada phi tip ia jingim jong phi ha 5 snem kynmaw, phi ïoh kumno? Dei noh phi jingmut ban ïoh bad dei noh phi burom?',
    },
    probes: [
      {
        en: 'What opportunities feel open to you here in Meghalaya?',
        kh: 'Dei dei jingïoh lah phi tip ban ïoh ha Meghalaya?',
        ga: 'Baksa opportunities ngi ong ïoh ha Meghalaya?',
        pn: 'Dei dei jingïoh lah phi tip ban ïoh ha Meghalaya?',
      },
      {
        en: 'Have you or anyone you know thought about leaving? What drives that?',
        kh: 'Phi bad raplang phi la tip ban leit? Dei noh pynmih ia noh?',
        ga: 'Ngi bad raplang jongngi la tip ban leit? Dei noh pynmih?',
        pn: 'Phi bad raplang phi la tip ban leit? Dei noh pynmih ia noh?',
      },
    ],
    facilitatorNote:
      'Look for: migration intentions and drivers, aspirations vs. perceived barriers, gendered differences in opportunity. Note if group goes silent on certain futures.',
  },
  {
    id: 'fgd_mind_1',
    section: 'mind_emotions',
    sectionColor: '#8b5cf6',
    mainQuestion: {
      en: 'Young people everywhere deal with stress, worry, or difficult feelings. What kinds of things weigh on young people here?',
      kh: 'Khynmaw nongïaid jingïaid ïap ïap ha burom, jingphai, bad jingiasem bym lah. Dei dei thaw pynkrehthaw ia khynmaw nongïaid ha neh?',
      ga: 'Khynmaw aro ïap ïap ha burom, jingphai, bad jingiasem bym lah. Dei dei thaw ong weight ha khynmaw aro ha neh?',
      pn: 'Khynmaw nongïaid jingïaid ïap ïap ha burom, jingphai, bad jingiasem bym lah. Dei dei thaw pynkrehthaw ia khynmaw nongïaid ha neh?',
    },
    probes: [
      {
        en: 'Where do people usually go when they are struggling emotionally?',
        kh: 'Ha kano nongkynmaw wan sha haba tip jingiasem bym lah?',
        ga: 'Ha kano nongkynmaw ong sha haba jingiasem bym lah?',
        pn: 'Ha kano nongkynmaw wan sha haba tip jingiasem bym lah?',
      },
      {
        en: 'Is mental health talked about openly in your community?',
        kh: 'La ka jingthymme ia haba ha seng phi biang?',
        ga: 'La mental health ia haba ha seng jongngi?',
        pn: 'La ka jingthymme ia haba ha seng phi biang?',
      },
      {
        en: 'What stops people from seeking help?',
        kh: 'Dei noh bym pynlait ia nongkynmaw ban pynhiar jingïasist?',
        ga: 'Dei noh bym pynlait ia ngi ban pynhiar help?',
        pn: 'Dei noh bym pynlait ia nongkynmaw ban pynhiar jingïasist?',
      },
    ],
    facilitatorNote:
      'Use third-person framing to reduce stigma ("young people here" vs. "you"). Listen for: stigma, shame, local idioms of distress, spiritual explanations, gendered coping. Note silences carefully.',
  },
  {
    id: 'fgd_health_1',
    section: 'health_relationships',
    sectionColor: '#ef4444',
    mainQuestion: {
      en: 'How do young people in this area talk about bodies, health, and relationships? Is it easy or difficult to get information about sexual health?',
      kh: 'Kumno khynmaw nongïaid ha neh ia haba sha, jingshong, bad jingim? Dei tip lah ban ïoh information ha SRH?',
      ga: 'Kumno khynmaw aro ha neh ia haba sha, jingshong, bad jingim? Dei tip lah ban ïoh SRH information?',
      pn: 'Kumno khynmaw nongïaid ha neh ia haba sha, jingshong, bad jingim? Dei tip lah ban ïoh information ha SRH?',
    },
    probes: [
      {
        en: 'Where do young people get information about relationships and sex?',
        kh: 'Ha kano khynmaw nongïaid ïoh information ha jingim bad SRH?',
        ga: 'Ha kano khynmaw aro ïoh information ha SRH bad jingim?',
        pn: 'Ha kano khynmaw nongïaid ïoh information ha jingim bad SRH?',
      },
      {
        en: 'Are there things that feel shameful or difficult to talk about?',
        kh: 'Dei noh thaw tip jingïohleh bad bym lah ban ia ia?',
        ga: 'Dei noh ong shame bad bym lah ban ia ia?',
        pn: 'Dei noh thaw tip jingïohleh bad bym lah ban ia ia?',
      },
    ],
    facilitatorNote:
      'This section may produce silence. That is data. Do not rush. Note what is unsayable. For mixed groups consider whether to proceed or defer to same-gender breakouts.',
  },
  {
    id: 'fgd_cmyc_1',
    section: 'cmyc',
    sectionColor: '#6366f1',
    mainQuestion: {
      en: 'We are here because of the Community Mental Wellness Centre — the CMYC. What would make a place like this truly useful for young people here?',
      kh: 'Ngin wan neh da u CMYC. Dei noh ban pynmih ia ka CMYC ban dei lah biang sha khynmaw nongïaid ha neh?',
      ga: 'Ngin wan neh da CMYC. Dei noh ban pynmih ia CMYC ban dei lah biang sha khynmaw aro ha neh?',
      pn: 'Ngin wan neh da u CMYC. Dei noh ban pynmih ia ka CMYC ban dei lah biang sha khynmaw nongïaid ha neh?',
    },
    probes: [
      {
        en: 'What would make you feel comfortable coming here?',
        kh: 'Dei noh ban pynmih ia phi ban tip lah ban wan ha neh?',
        ga: 'Dei noh ban pynmih ia ngi ban tip comfortable ban wan ha neh?',
        pn: 'Dei noh ban pynmih ia phi ban tip lah ban wan ha neh?',
      },
      {
        en: 'What services do you most need that do not exist yet?',
        kh: 'Dei dei services phi dang neh biang ha bym ïoh pat?',
        ga: 'Baksa services ngi dang neh biang ha bym ïoh pat?',
        pn: 'Dei dei services phi dang neh biang ha bym ïoh pat?',
      },
      {
        en: 'What would you say to a friend who was hesitant to come?',
        kh: 'Dei noh phi ia ia sha raplang phi ha tip ia kaba wan?',
        ga: 'Dei noh ngi ia ia sha raplang jongngi ha bym lah ban wan?',
        pn: 'Dei noh phi ia ia sha raplang phi ha tip ia kaba wan?',
      },
    ],
    facilitatorNote:
      'End on a constructive note. Ask what one thing the CMYC could do that would make the biggest difference. Collect any "one more thing" that was not said aloud.',
  },
]

export const FGD_SECTION_LABELS: Record<string, string> = {
  opening: 'Opening',
  daily_life: 'Daily Life',
  work_future: 'Work & Future',
  mind_emotions: 'Mind & Emotions',
  health_relationships: 'Health & Relationships',
  cmyc: 'CMYC',
}
