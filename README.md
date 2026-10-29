<div align="center">

<img src="assets/banner.svg" alt="LFR Extension" width="100%">

<br>

![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white)
![Version](https://img.shields.io/badge/version-1.2.1-2dd4bf?style=for-the-badge)
![Platform](https://img.shields.io/badge/Desktop%20%7C%20Mobile-supported-60a5fa?style=for-the-badge)
![RTL](https://img.shields.io/badge/RTL%20%2F%20LTR-smart-a78bfa?style=for-the-badge)

**فارسی** · [English](#english)

</div>

<div dir="rtl">

# LFR Extension — افزونه راست‌چین/چپ‌چین هوشمند، ابزار فارسی‌نویسی و مدیریت فونت برای Obsidian

**LFR Extension** یک افزونه (پلاگین) برای Obsidian است که نوشتن متن‌های فارسی، عربی، عبری و متن‌های دوزبانه را بدون دردسر می‌کند. جهت متن را برای هر پاراگراف خودکار تشخیص می‌دهد، کد و YAML و لینک‌ها را همیشه چپ‌چین نگه می‌دارد، لیست‌ها و نقل‌قول‌ها و جدول‌ها را برای متن راست‌چین مرتب می‌کند، ابزارهای نگارشی فارسی دارد و به شما اجازه می‌دهد فونت دلخواه خودتان را (با حالت‌های Bold و Italic) اضافه کنید، حتی برای خروجی PDF.

## ✨ امکانات

### ۱. راست‌چین / چپ‌چین هوشمند
- جهت هر خط یا پاراگراف به‌صورت پیش‌فرض از روی **اکثریت کلمات** تشخیص داده می‌شود (فارسی/عربی/عبری ← راست‌چین، لاتین ← چپ‌چین) و در صورت تساوی، اولین حرف تعیین‌کننده است. از تنظیمات می‌توانید روش «اولین حرف معتبر» را هم انتخاب کنید.
- علامت‌های مارک‌داون مثل `#`، `-`، `1.`، `>` و `[x]` در تشخیص نادیده گرفته می‌شوند.
- خط خالی جهت خط قبلی را نگه می‌دارد تا هنگام تایپ، مکان‌نما نپرد.
- در **Source mode**، **Live Preview**، **Reading view** و **خروجی PDF** کار می‌کند.
- **متن‌های مخلوط:** جمله‌ای که با کلمه‌ی انگلیسی شروع می‌شود، ادامه‌اش فارسی است و وسطش دوباره انگلیسی دارد، به‌هم نمی‌ریزد. هر عبارت انگلیسی داخل جمله‌ی فارسی (و برعکس) ایزوله می‌شود تا ترتیب کلمات، علائم نگارشی و پرانتزها درست بمانند.
- عنوان یادداشت (inline title) هم جهت خودش را می‌گیرد.

### ۲. کد، YAML و URL همیشه LTR
- بلاک‌های کد (<code>```</code> و <code>~~~</code>)، فرانت‌متر YAML و بلوک‌های ریاضی `$$` همیشه چپ‌چین‌اند.
- کد درون‌خطی و لینک‌های URL حتی وسط یک جمله فارسی هم به‌درستی و چپ‌چین نمایش داده می‌شوند.
- خطی که فقط یک URL دارد، چپ‌چین می‌شود.

### ۳. زیباسازی مارک‌داون برای متن راست‌چین
در متن راست‌چین این عناصر هم آینه می‌شوند (از تنظیمات قابل خاموش کردن است):
- بولت‌ها و شماره‌ی لیست‌ها و تورفتگی آن‌ها
- چک‌باکس‌ها
- خط کنار نقل‌قول (Blockquote)
- آیکون و عنوان Callout و فلش بازشدن آن
- جدول‌ها (ستون اول سمت راست) و تراز سلول‌ها

### ۴. تغییر جهت بخش انتخاب‌شده با کلیک راست
- متن را انتخاب کنید ← کلیک راست ← **Format** ← **RTL** (با آیکون راست‌چین) یا **LTR** (با آیکون چپ‌چین).
- فقط همان بخش انتخاب‌شده تغییر می‌کند:
  - انتخاب بخشی از یک خط ← با `<span dir="rtl">…</span>` پوشانده می‌شود.
  - انتخاب یک خط کامل یا چند خط ← محتوای هر خط با `<span dir="rtl">…</span>` پوشانده می‌شود (علامت‌های مارک‌داون مثل `#` و `-` و `>` بیرون آن می‌مانند و کد و جدول نادیده گرفته می‌شوند). به همین دلیل در **Reading view** و **خروجی PDF** هم اعمال می‌شود.
- زدن دوباره‌ی همان جهت، قالب را برمی‌دارد و زدن جهت مخالف، جهت را عوض می‌کند.
- در **Live Preview** تگ‌های `<span dir>` و `<div dir>` مخفی می‌شوند و فقط متن نهایی دیده می‌شود. با قرار دادن مکان‌نما روی آن‌ها (یا در Source mode) تگ‌ها نمایش داده می‌شوند.

### ۵. دکمه‌ی جهت در نوار وضعیت و دستور تغییر جهت پاراگراف
- در نوار وضعیت (پایین پنجره) جهت پاراگراف فعلی (RTL یا LTR) نمایش داده می‌شود. با کلیک روی آن می‌توانید جهت **پاراگراف فعلی** یا **کل یادداشت** را تغییر دهید.
- بدون انتخاب متن هم می‌توانید با دستورها جهت پاراگراف را عوض کنید:
  `Set current paragraph direction: RTL / LTR / Auto` و `Toggle current paragraph direction`.
  (می‌توانید برایشان کلید میانبر تعیین کنید.)

### ۶. ابزارهای نگارشی فارسی
از کلیک راست ← **Persian tools** یا از Command Palette در دسترس‌اند. اگر متنی انتخاب شده باشد فقط روی آن، وگرنه روی کل یادداشت (بدون فرانت‌متر) اجرا می‌شوند. کد، لینک، URL، لینک ویکی (`[[…]]`)، تگ‌های HTML و فرمول‌ها دست‌نخورده می‌مانند.

| ابزار | مثال |
|---|---|
| اصلاح نیم‌فاصله | «می خواهم» ← «می‌خواهم»، «کتاب ها» ← «کتاب‌ها»، «بزرگ تر» ← «بزرگ‌تر»، «خانه ی» ← «خانه‌ی» |
| تبدیل حروف عربی به فارسی | «ي» ← «ی»، «ك» ← «ک»، «ى» ← «ی» |
| اصلاح علائم نگارشی | `,` ← `،` ، `?` ← `؟` ، `;` ← `؛` (فقط بعد از حروف فارسی) |
| پاک‌سازی کامل | هر سه مورد بالا با هم |

### ۷. مدیریت فونت (با Bold و Italic)
- از منوی سه‌نقطه (**More options**) بالای یادداشت ← **Font**.
- گزینه‌ی **Add Font** (با آیکون +) فایل فونت `ttf` / `otf` / `woff` / `woff2` را اضافه می‌کند. می‌توانید چند فایل را با هم انتخاب کنید (مثلاً `Vazirmatn-Regular`، `Vazirmatn-Bold` و `Vazirmatn-Italic`)؛ بر اساس نام فایل، همه در یک فونت و در حالت‌های Regular، Bold و Italic قرار می‌گیرند. حالت‌های ناقص را بعداً از **تنظیمات** هم می‌توانید اضافه کنید.
- زیر آن یک خط جداکننده و سپس فهرست فونت‌ها قرار می‌گیرد و **اسم هر فونت با خود همان فونت** نمایش داده می‌شود. با کلیک روی هر فونت، همان فونت اعمال می‌شود (فونت فعال تیک دارد؛ کلیک دوباره روی آن به فونت پیش‌فرض برمی‌گردد).
- **اندازه‌ی فونت** و **ارتفاع خط** (line-height) را هم از تنظیمات می‌توانید تعیین کنید.
- **خروجی PDF** با همان فونت انتخاب‌شده گرفته می‌شود.
- فونت روی **کدها، YAML و باکس‌های شل اعمال نمی‌شود** و آن‌ها مونواسپیس می‌مانند.
- فونت‌ها در پوشه‌ی `fonts` داخل پوشه‌ی افزونه ذخیره می‌شوند و از بخش تنظیمات می‌توان آن‌ها را حذف کرد.

### ۸. تنظیم جهت و فونت برای هر یادداشت یا پوشه
اولویت: **فرانت‌متر یادداشت ← قانون پوشه ← تنظیم عمومی**.

```yaml
---
direction: rtl      # rtl | ltr | auto
font: Vazirmatn     # نام فونتِ اضافه‌شده، یا none برای فونت پیش‌فرض
---
```

- با فرانت‌متر، تشخیص خودکار برای آن یادداشت خاموش می‌شود و همه‌ی پاراگراف‌ها جهت مشخص‌شده را می‌گیرند (کد و YAML همچنان LTR می‌مانند).
- در **Settings ← LFR Extension ← Folder rules** می‌توانید برای یک پوشه (و زیرپوشه‌هایش) جهت و فونت پیش‌فرض تعیین کنید.
- از نوار وضعیت یا دستورهای `Set note direction` هم می‌توانید `direction` را خودکار در فرانت‌متر بنویسید.

## 📦 نصب

### روش دستی
۱. آخرین نسخه را از بخش [Releases](https://github.com/xeno-rdx/LFR-Extension/releases) دانلود کنید (یا این مخزن را Clone کنید).

۲. پوشه‌ای با نام دقیق `LFR-Extension` در مسیر زیر بسازید:

```text
<مسیر Vault>/.obsidian/plugins/LFR-Extension/
```

۳. این سه فایل را داخل آن پوشه کپی کنید:

```text
LFR-Extension/
├── main.js
├── manifest.json
└── styles.css
```

۴. Obsidian را ببندید و دوباره باز کنید (یا Reload کنید).

۵. به **Settings ← Community plugins** بروید، اگر **Restricted mode** روشن است آن را خاموش کنید و **LFR Extension** را فعال کنید.

۶. در **Settings ← Editor** گزینه‌ی داخلی **Right-to-left** را خاموش کنید تا با افزونه تداخل نداشته باشد.

> 💡 پوشه‌ی `.obsidian` مخفی است. در ویندوز گزینه‌ی Show hidden files و در macOS کلید‌های <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>.</kbd> را بزنید.

> ⚠️ اگر قبلاً نسخه‌ی قدیمی با نام `LFR-Extention` یا `smart-bidi-fonts` را نصب کرده بودید، آن پوشه را حذف کنید و فونت‌هایتان را دوباره اضافه کنید.

### نصب با BRAT
۱. افزونه‌ی [BRAT](https://github.com/TfTHacker/obsidian42-brat) را از Community plugins نصب و فعال کنید.

۲. در تنظیمات BRAT روی **Add Beta plugin** بزنید و این آدرس را وارد کنید:

```text
xeno-rdx/LFR-Extension
```

۳. افزونه را در **Settings ← Community plugins** فعال کنید. BRAT نسخه‌های بعدی را هم خودکار به‌روزرسانی می‌کند.

## 🚀 نحوه‌ی استفاده

| کار | روش |
|---|---|
| تغییر جهت بخش انتخاب‌شده | انتخاب متن ← کلیک راست ← Format ← RTL / LTR |
| تغییر جهت پاراگراف فعلی | کلیک روی دکمه‌ی جهت در نوار وضعیت، یا دستور `Toggle current paragraph direction` |
| تغییر جهت کل یادداشت | نوار وضعیت ← This note، یا فرانت‌متر `direction: rtl` |
| اصلاح نیم‌فاصله و علائم فارسی | کلیک راست ← Persian tools |
| اضافه کردن فونت | منوی ⋯ ← Font ← Add Font |
| اعمال فونت | منوی ⋯ ← Font ← نام فونت |
| اضافه کردن Bold / Italic به یک فونت | Settings ← LFR Extension ← Fonts ← دکمه‌ی همان حالت |
| فونت یا جهت مخصوص یک پوشه | Settings ← LFR Extension ← Folder rules |
| بازگشت به فونت پیش‌فرض | کلیک دوباره روی فونت فعال، یا Settings ← Use theme font |
| خاموش/روشن کردن تشخیص هوشمند | Settings ← LFR Extension ← Smart text direction |
| تغییر روش تشخیص جهت | Settings ← LFR Extension ← Direction detection |
| خاموش/روشن کردن ایزوله‌سازی متن مخلوط | Settings ← LFR Extension ← Isolate mixed-direction text |
| خاموش/روشن کردن زیباسازی RTL | Settings ← LFR Extension ← Beautify RTL markdown |

## ⚠️ نکات مهم

- زیرمنوی **Format** در کلیک راست API رسمی ندارد. افزونه آن را پیدا می‌کند و گزینه‌ها را به آن اضافه می‌کند. اگر در نسخه‌ای از Obsidian پیدا نشد، گزینه‌ها در یک زیرمنوی جدا به نام **Text direction** نمایش داده می‌شوند.
- تغییر جهت دستی با تگ‌های HTML استاندارد ذخیره می‌شود، پس یادداشت‌ها در برنامه‌های دیگر هم جهت را حفظ می‌کنند. یادداشت‌هایی که با نسخه‌های قبلی با `<div dir>` ساخته شده بودند هم خوانده می‌شوند.
- ظاهر دقیق لیست‌ها، نقل‌قول‌ها و callout‌ها به تم انتخابی شما بستگی دارد؛ اگر در تمی چیزی کج دیده شد، Issue بزنید.
- تغییر تنظیمات تشخیص جهت در Reading view بعد از باز کردن دوباره‌ی یادداشت اعمال می‌شود.
- دکمه‌ی نوار وضعیت فقط در نسخه‌ی دسکتاپ نمایش داده می‌شود؛ در موبایل از دستورها استفاده کنید.
- فونت خروجی PDF، فونت یادداشتی است که در حال گرفتن خروجی از آن هستید.

## 🗂 ساختار پروژه

```text
LFR-Extension/
├── assets/
│   ├── banner.svg
│   └── divider.svg
├── main.js
├── manifest.json
├── styles.css
└── README.md
```

## 🤝 مشارکت

Issue و Pull Request خوش‌آمد است. اگر باگی دیدید، نسخه‌ی Obsidian، سیستم‌عامل و متن خطای کنسول (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>) را ذکر کنید.

</div>

<br>

<div align="center">
  <img src="assets/divider.svg" alt="divider" width="100%">
</div>

<br>

<a id="english"></a>

# LFR Extension — Smart RTL/LTR, Persian Typography Tools & Font Manager for Obsidian

**LFR Extension** is an Obsidian plugin that makes writing Persian, Arabic, Hebrew and mixed-direction notes effortless. It detects the direction of every paragraph automatically, always keeps code, YAML and URLs left-to-right, lays out lists, quotes and tables properly for right-to-left text, ships Persian typography tools, and lets you add your own fonts (with Bold and Italic styles), including for PDF export.

## ✨ Features

### 1. Smart RTL / LTR
- The direction of each line or paragraph is detected by default from the **majority of its words** (Persian/Arabic/Hebrew → RTL, Latin → LTR); ties are decided by the first strong letter. You can switch to "First strong letter" in the settings.
- Markdown markers such as `#`, `-`, `1.`, `>` and `[x]` are ignored during detection.
- Blank lines keep the previous direction, so the cursor does not jump while you type.
- Works in **Source mode**, **Live Preview**, **Reading view** and **PDF export**.
- **Mixed-direction text:** a sentence that starts with an English word, continues in Persian and has English again in the middle stays readable. Every English phrase inside a Persian sentence (and the reverse) is isolated, so word order, punctuation and parentheses stay correct.
- The note title (inline title) follows its own direction too.

### 2. Code, YAML and URLs are always LTR
- Code blocks (<code>```</code> and <code>~~~</code>), YAML frontmatter and `$$` math blocks are always left-to-right.
- Inline code and URLs render correctly as LTR even in the middle of an RTL sentence.
- A line that contains only a URL is always LTR.

### 3. Markdown beautification for RTL text
In right-to-left text these elements are mirrored too (can be turned off in the settings):
- Bullets, list numbers and list indentation
- Checkboxes
- The blockquote bar
- Callout icon, title and fold arrow
- Tables (first column on the right) and cell alignment

### 4. Per-selection direction from the context menu
- Select text → right-click → **Format** → **RTL** (align-right icon) or **LTR** (align-left icon).
- Only the selected part is changed:
  - A partial selection inside a line is wrapped in `<span dir="rtl">…</span>`.
  - A full line or several lines get a `<span dir="rtl">…</span>` around the content of each line (markdown markers such as `#`, `-` and `>` stay outside; code and tables are skipped). This is why it also works in **Reading view** and **PDF export**.
- Choosing the same direction again removes the wrapper; choosing the opposite direction switches it.
- In **Live Preview** the `<span dir>` and `<div dir>` tags are hidden and only the final text is shown. Put the cursor on them (or use Source mode) to see the tags.

### 5. Status bar button and paragraph direction command
- The status bar shows the direction of the current paragraph (RTL or LTR). Click it to change the direction of the **current paragraph** or of the **whole note**.
- You can also change a paragraph without selecting any text, using the commands
  `Set current paragraph direction: RTL / LTR / Auto` and `Toggle current paragraph direction` (assign hotkeys to them if you like).

### 6. Persian typography tools
Available from right-click → **Persian tools** or from the Command Palette. They run on the selection, or on the whole note (without frontmatter) when nothing is selected. Code, links, URLs, wikilinks (`[[…]]`), HTML tags and math are left untouched.

| Tool | Example |
|---|---|
| Fix half-spaces (ZWNJ) | "می خواهم" → "می‌خواهم", "کتاب ها" → "کتاب‌ها", "بزرگ تر" → "بزرگ‌تر", "خانه ی" → "خانه‌ی" |
| Arabic → Persian letters | "ي" → "ی", "ك" → "ک", "ى" → "ی" |
| Fix punctuation | `,` → `،` , `?` → `؟` , `;` → `؛` (only after Persian letters) |
| Clean up (all) | All three at once |

### 7. Font manager (with Bold and Italic)
- Open the three-dot menu (**More options**) of a note → **Font**.
- **Add Font** (with a + icon) imports `ttf` / `otf` / `woff` / `woff2` files. You can select several files at once (for example `Vazirmatn-Regular`, `Vazirmatn-Bold` and `Vazirmatn-Italic`); they are grouped into one font by their file names as Regular, Bold and Italic. Missing styles can be added later from the settings.
- Below it, after a separator, all fonts are listed and **each name is shown in its own font**. Click a font to apply it (the active font is checked; clicking it again returns to the theme font).
- **Font size** and **line height** can be set in the settings.
- **PDF export** uses the selected font.
- The font is **not applied to code, YAML or shell-like boxes**, which stay monospace.
- Fonts are stored in the `fonts` folder inside the plugin folder and can be removed from the plugin settings.

### 8. Per-note and per-folder direction and font
Priority: **note frontmatter → folder rule → global setting**.

```yaml
---
direction: rtl      # rtl | ltr | auto
font: Vazirmatn     # the name of an added font, or none for the theme font
---
```

- With frontmatter, automatic detection is turned off for that note and every paragraph gets the given direction (code and YAML stay LTR).
- In **Settings → LFR Extension → Folder rules** you can set a default direction and font for a folder (and its subfolders).
- The status bar and the `Set note direction` commands write `direction` into the frontmatter for you.

## 📦 Installation

### Manual installation
1. Download the latest release from the [Releases](https://github.com/xeno-rdx/LFR-Extension/releases) page (or clone this repository).

2. Create a folder named exactly `LFR-Extension` at:

```text
<your vault>/.obsidian/plugins/LFR-Extension/
```

3. Copy these three files into it:

```text
LFR-Extension/
├── main.js
├── manifest.json
└── styles.css
```

4. Restart Obsidian (or reload it).

5. Go to **Settings → Community plugins**, turn off **Restricted mode** if it is on, and enable **LFR Extension**.

6. In **Settings → Editor**, turn off Obsidian's built-in **Right-to-left** option to avoid conflicts.

> 💡 The `.obsidian` folder is hidden. On Windows enable "Show hidden files"; on macOS press <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>.</kbd>.

> ⚠️ If you previously installed the old `LFR-Extention` or `smart-bidi-fonts` folder, delete it and add your fonts again.

### Install with BRAT
1. Install and enable the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from Community plugins.

2. In the BRAT settings click **Add Beta plugin** and enter this repository:

```text
xeno-rdx/LFR-Extension
```

3. Enable the plugin in **Settings → Community plugins**. BRAT keeps it updated with new releases automatically.

## 🚀 Usage

| Task | How |
|---|---|
| Change direction of a selection | Select text → right-click → Format → RTL / LTR |
| Change direction of the current paragraph | Click the status bar button, or run `Toggle current paragraph direction` |
| Change direction of the whole note | Status bar → This note, or frontmatter `direction: rtl` |
| Fix Persian half-spaces and punctuation | Right-click → Persian tools |
| Add a font | ⋯ menu → Font → Add Font |
| Apply a font | ⋯ menu → Font → font name |
| Add Bold / Italic to a font | Settings → LFR Extension → Fonts → the matching style button |
| Set a direction or font for a folder | Settings → LFR Extension → Folder rules |
| Return to the default font | Click the active font again, or Settings → Use theme font |
| Toggle smart detection | Settings → LFR Extension → Smart text direction |
| Change the detection method | Settings → LFR Extension → Direction detection |
| Toggle mixed-text isolation | Settings → LFR Extension → Isolate mixed-direction text |
| Toggle RTL beautification | Settings → LFR Extension → Beautify RTL markdown |

## ⚠️ Notes

- The right-click **Format** submenu has no official API. The plugin locates it and appends its options. If it cannot be found in your Obsidian version, the options appear in a separate **Text direction** submenu instead.
- Manual direction is stored with standard HTML tags, so your notes keep their direction in other apps too. Notes made with `<div dir>` by earlier versions are still read correctly.
- The exact look of lists, quotes and callouts depends on your theme; if something looks off in a theme, please open an issue.
- Changing the detection settings takes effect in Reading view after re-opening the note.
- The status bar button is desktop-only; on mobile use the commands.
- The PDF font is the font of the note you are exporting.

## 🗂 Project structure

```text
LFR-Extension/
├── assets/
│   ├── banner.svg
│   └── divider.svg
├── main.js
├── manifest.json
├── styles.css
└── README.md
```

## 🤝 Contributing

Issues and pull requests are welcome. When reporting a bug, please include your Obsidian version, operating system and the console error (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>).
