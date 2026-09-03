# OWLDIO MENU Domain Context

## Glossary

| Term | Definition |
| --- | --- |
| Programme（節目冊） | 一場表演對應的一份數位節目冊，以全站唯一的節目代稱形成單層公開網址。 |
| Client（客戶） | 擁有一個或多個節目冊的製作單位、團隊或藝術家。 |
| Chapter（章節） | 節目冊中的可跳轉閱讀單元，例如曲目、導演的話、演職人員或場館資訊。 |
| Original PDF（原始 PDF） | 客戶上傳的印刷版節目單檔案；是次要閱讀方式，不取代原生網頁內容。 |
| Public Index（作品索引） | 平台首頁的公開書架，只列出 Published 節目冊。 |
| Admin（管理者） | 經認證且列入管理名單，能建立、編輯、上傳 PDF 與變更發布狀態的人。 |
| Draft（草稿） | 僅管理者可查看或修改，公開網址不可讀取。 |
| Unlisted（不列入索引） | 不出現在作品索引，但知道獨立網址的觀眾可以閱讀。 |
| Published（已發布） | 會出現在作品索引，也能由獨立網址閱讀。 |
| Archived（已封存） | 從公開閱讀中撤下並保留於後台的節目冊。 |

## Invariants

- Programme 的 `slug` 必須全站唯一；`client_slug` 僅供後台歸屬與管理。
- 已發布的公開網址使用 `/{slug}`；舊的 `/{client_slug}/{slug}` 只作相容轉址。
- Draft 與 Archived 不可由未登入觀眾讀取。
- 只有 Published 會出現在 Public Index。
- Original PDF 必須是 PDF，且不得超過平台限制。
- 只有 Admin 可以寫入節目冊資料或上傳、替換 PDF。
