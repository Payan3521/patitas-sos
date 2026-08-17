document.addEventListener("DOMContentLoaded", function () {
  function cerrarTodos() {
    document.querySelectorAll(".share-wrap.open").forEach(function (w) {
      w.classList.remove("open");
    });
  }
  document.querySelectorAll("[data-share-btn]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var wrap = btn.closest(".share-wrap");
      if (!wrap) return;
      if (wrap.classList.contains("open")) {
        wrap.classList.remove("open");
      } else {
        cerrarTodos();
        wrap.classList.add("open");
      }
    });
  });
  document.addEventListener("click", cerrarTodos);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrarTodos();
  });
});