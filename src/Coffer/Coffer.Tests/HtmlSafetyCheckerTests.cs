using Coffer.BusinessLogic.Extensions;

namespace Coffer.Tests
{
    public class HtmlSafetyCheckerTests
    {
        [Theory]
        [InlineData("<img src=x onerror=alert(1)>")]                       // event handler, no <script>
        [InlineData("<p onclick=\"steal()\">hi</p>")]                       // event handler on allowed tag
        [InlineData("<a href=intent://evil#Intent;end>tap</a>")]            // unquoted href bypassed the old regex
        [InlineData("<a href='tel:+3612345'>call</a>")]                     // non-http scheme
        [InlineData("<iframe src=\"https://evil.example\"></iframe>")]      // embedded frame
        [InlineData("<img src=\"file:///etc/passwd\">")]                    // non-http resource
        [InlineData("<script>alert(1)</script>")]                           // original check still holds
        [InlineData("<a href=\"javascript:alert(1)\">x</a>")]               // original check still holds
        public void Rejects_DangerousHtml(string html)
        {
            Assert.False(HtmlSafetyChecker.IsHtmlSafe(html));
        }

        [Theory]
        [InlineData("")]
        [InlineData("plain text")]
        [InlineData("<p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s></p>")]
        [InlineData("<h1>Title</h1><h3>Sub</h3><ul><li>a</li></ul><ol><li>b</li></ol>")]
        [InlineData("<blockquote>q</blockquote><pre><code class=\"language-js\">x</code></pre><hr><br>")]
        [InlineData("<p><a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://example.com\">link</a></p>")]
        [InlineData("<ul data-type=\"taskList\"><li data-checked=\"true\">done</li></ul>")]
        [InlineData("<p><span style=\"color: #ff0000\">red</span><mark>hl</mark></p>")]
        [InlineData("<p><img src=\"data:image/png;base64,iVBORw0KGgo=\"></p>")]              // pasted image (was accepted before)
        [InlineData("<p><img src=\"https://example.com/a.png\"></p>")]
        public void Accepts_RichTextEditorOutput(string html)
        {
            Assert.True(HtmlSafetyChecker.IsHtmlSafe(html));
        }
    }
}
