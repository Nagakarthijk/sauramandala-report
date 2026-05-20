package org.sauramandala.lingualkeys

object SwipeDictionary {

    // ~400 most commonly typed words in messaging/daily use
    private val words = setOf(
        "a","i","am","an","as","at","be","by","do","go","he","hi","if","in","is",
        "it","me","my","no","of","ok","on","or","so","to","up","us","we","ago",
        "all","and","any","are","ask","bad","big","but","buy","can","car","dad",
        "day","did","eat","end","far","few","for","fun","get","got","had","has",
        "her","hey","him","his","hit","hot","how","ice","joy","kid","let","low",
        "mad","man","may","mom","new","not","now","odd","off","old","one","our",
        "out","own","pay","put","red","run","sad","sat","say","sea","set","she",
        "shy","sin","sit","son","sun","ten","the","tie","tip","too","top","toy",
        "try","two","use","war","was","way","web","wet","who","why","win","yet",
        "you","zip","able","also","area","army","baby","back","bake","ball","band",
        "bank","bare","base","bath","bean","bear","beat","been","beer","bell","belt",
        "bill","bird","bite","blow","blue","bold","bomb","bone","book","boot","both",
        "burn","busy","cafe","cake","call","calm","came","camp","care","cart","case",
        "cave","cell","chat","chip","chop","city","clap","clip","club","clue","coal",
        "coat","code","cold","comb","come","cook","cool","cope","cord","core","corn",
        "cost","crew","crop","cube","cure","cute","damp","dark","data","date","dawn",
        "dead","deal","dear","deep","desk","dirt","disk","dive","dock","does","door",
        "dose","down","drag","draw","drop","drum","duck","dump","dust","duty","each",
        "earn","east","edge","else","epic","even","ever","evil","exit","fade","fail",
        "fair","fake","fall","fame","farm","fast","fill","film","find","fire","firm",
        "fish","flag","flat","flip","flow","foam","fold","folk","food","fool","foot",
        "form","fort","free","from","fuel","full","fury","fuse","gaze","gear","gift",
        "glad","glow","glue","gold","golf","good","grab","gray","grew","grim","grin",
        "grip","grow","hack","hail","half","hall","hand","hang","hard","harm","hate",
        "have","head","heal","hear","heat","heel","held","helm","help","here","hide",
        "high","hill","hint","hire","hold","hole","home","hood","hook","hope","horn",
        "hour","hunt","hurt","icon","idea","idle","inch","into","iron","item","jail",
        "jazz","jerk","join","joke","jump","just","keen","keep","kick","kill","kind",
        "king","know","lack","laid","lame","land","lane","last","late","lead","lean",
        "leap","left","less","lick","lift","like","line","lion","list","live","load",
        "loan","lock","look","loop","loss","love","luck","make","mall","mash","mass",
        "meal","mean","meat","meet","melt","mind","mine","mint","miss","mode","moon",
        "more","most","move","much","must","name","neat","neck","need","node","norm",
        "note","once","only","open","page","palm","park","part","pass","past","path",
        "peak","peel","pest","pick","pile","pipe","plan","play","plot","plus","poke",
        "pole","pond","pork","port","pose","post","pour","pray","prey","prop","pull",
        "pump","pure","push","quit","rage","rain","rank","rate","read","real","reap",
        "rely","rest","rice","rich","ride","rise","risk","road","roam","roar","robe",
        "rock","role","roll","roof","root","rope","rose","ruin","rule","rush","safe",
        "sail","salt","same","scan","seal","seed","seek","seem","self","sell","send",
        "sent","ship","shop","shot","show","sick","side","silk","size","skin","skip",
        "slam","slim","slip","slow","snap","snow","soak","soar","sock","soft","sold",
        "some","song","soon","sort","soul","sour","spin","spot","star","stay","stem",
        "step","stir","stop","suit","swim","tail","talk","tall","tape","task","tent",
        "term","test","text","that","them","then","they","thin","this","tide","tile",
        "tilt","time","tiny","tone","tool","tour","town","trap","tree","trim","trip",
        "true","tube","tune","turn","type","vain","very","view","vote","wade","wait",
        "wake","walk","wall","want","warn","weak","wear","weed","week","well","went",
        "were","what","when","wide","wife","wild","will","wind","wine","wing","wire",
        "wish","with","wood","word","wore","work","wrap","year","your","zone","zoom",
        // Common chat words
        "about","after","again","alone","along","angry","apart","apply","arise",
        "asked","avoid","awake","aware","awful","basic","began","begin","being",
        "below","break","bring","broke","build","built","carry","cause","chair",
        "check","chest","chief","child","class","clean","clear","climb","close",
        "cloud","coast","count","cover","crazy","cross","crowd","cycle","daily",
        "dance","doing","doubt","dream","drink","drive","early","earth","eight",
        "enjoy","enter","equal","error","event","every","exact","exist","extra",
        "faced","falls","false","fancy","fears","feast","feels","field","fifth",
        "final","first","fixed","flesh","floor","focus","force","front","fruit",
        "fully","funny","given","glass","going","grace","grade","grand","grant",
        "grass","great","green","greet","gross","group","grown","guard","guess",
        "guest","guide","guilt","happy","harsh","haven","heart","heavy","hence",
        "hello","hoped","house","human","humor","hurry","ideal","image","imply",
        "inner","input","isn't","issue","joint","judge","keeps","knock","known",
        "large","laugh","layer","learn","legal","level","light","liked","limit",
        "local","logic","lonely","looks","loose","lower","lucky","lunch","lying",
        "magic","major","makes","march","meant","media","mercy","merit","metal",
        "might","minor","model","money","month","moral","moral","mount","mouth",
        "moved","music","never","night","north","noted","novel","occur","offer",
        "often","opens","order","other","ought","outer","owner","owned","paper",
        "party","pause","peace","phase","phone","photo","piece","pilot","place",
        "plain","plant","plate","plead","point","power","press","price","pride",
        "prime","prior","prize","proof","proud","prove","quick","quiet","quite",
        "quote","range","rapid","reach","ready","refer","relax","reply","rider",
        "right","rigid","river","round","royal","ruler","rural","scale","scene",
        "score","scout","sense","serve","seven","shall","shame","shape","share",
        "sharp","shift","shirt","shoot","short","sight","silly","since","sixty",
        "skill","sleep","slide","slope","smile","smoke","solid","solve","sorry",
        "south","space","spare","speak","speed","spend","split","spoke","spray",
        "staff","stage","stake","stand","start","state","steal","steel","stick",
        "still","stock","stone","store","storm","story","store","sound","south",
        "shall","shrug","smile","smoke","south","stare","steam","stick","stood",
        "store","strap","strut","stuck","study","stuff","style","sugar","super",
        "sweet","swift","swing","table","taken","teach","teeth","their","there",
        "thing","think","third","three","threw","throw","timed","tired","title",
        "today","token","total","touch","track","trade","train","trust","truth",
        "unify","until","usual","utter","valid","value","video","visit","vital",
        "voice","waste","watch","water","where","which","while","whole","whose",
        "width","woman","women","world","worse","worst","worth","would","write",
        "wrong","wrote","young",
        // Greetings and common expressions
        "okay","nope","yep","yah","yeah","sure","lol","omg","btw","ily","hey",
        "bye","cya","ttyl","brb","idk","ngl","tbh","smh","fyi","asap","imo",
        "hello","thanks","thank","sorry","please","great","nice","cool","wow",
        "done","sent","seen","read","noted","agree","true","false","maybe","later"
    )

    /**
     * Match a swipe key path to the best word.
     * Strategy: start letter must match, end letter must match,
     * and the swipe path must be a subsequence of the candidate word.
     */
    fun match(path: String): String? {
        if (path.length < 2) return path.takeIf { words.contains(it) }

        val p = path.lowercase()
        val first = p.first()
        val last = p.last()

        // Exact match wins immediately
        if (words.contains(p)) return p

        // Collect candidates: start/end match + path is subsequence
        val candidates = words.filter { word ->
            word.length >= p.length &&
            word.first() == first &&
            word.last() == last &&
            isSubsequence(p, word)
        }

        // Prefer shortest matching word (most specific)
        return candidates.minByOrNull { it.length }
    }

    // Returns true if every character in sub appears in seq in order
    private fun isSubsequence(sub: String, seq: String): Boolean {
        var si = 0
        for (c in seq) {
            if (si < sub.length && c == sub[si]) si++
            if (si == sub.length) return true
        }
        return si == sub.length
    }
}
