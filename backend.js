document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("fontToggle");
  const body = document.body;

  // load the font
  const savedFont = localStorage.getItem("jpFontEnabled");

  if (savedFont === "true") {
    body.classList.add("jp-font");
    toggleBtn?.classList.add("active");
  }

  if (!toggleBtn) return;
  // toggle button 
  toggleBtn.addEventListener("click", () => {
    const isEnabled = body.classList.toggle("jp-font");
    toggleBtn.classList.toggle("active", isEnabled);

    // keep font while of diff pages  
    localStorage.setItem("jpFontEnabled", isEnabled);
  });
});
