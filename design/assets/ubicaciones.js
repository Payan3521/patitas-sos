const DEPARTAMENTOS = {
  "Amazonas": ["Leticia", "Puerto Nariño", "El Encanto", "La Pedrera", "La Chorrera", "Tarapacá", "Puerto Alegría", "Mirití-Paraná"],
  "Antioquia": ["Medellín", "Envigado", "Bello", "Itagüí", "Sabaneta", "Rionegro", "Marinilla", "Turbo", "Apartadó", "Caucasia", "Santa Fe de Antioquia", "Amagá"],
  "Arauca": ["Arauca", "Tame", "Saravena", "Arauquita", "Fortul", "Cravo Norte"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Puerto Colombia", "Sabanalarga", "Galapa", "Baranoa", "Sabanagrande"],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar", "Mompós", "María La Baja", "San Juan Nepomuceno"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Paipa", "Chiquinquirá", "Villa de Leyva", "Moniquirá", "Garagoa"],
  "Caldas": ["Manizales", "Villamaría", "Chinchiná", "La Dorada", "Riosucio", "Palestina", "Salamina"],
  "Caquetá": ["Florencia", "San Vicente del Caguán", "Belén de los Andaquíes", "Curillo", "Puerto Rico"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva", "Tauramena", "Paz de Ariporo", "Trinidad"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada", "Caloto", "Piendamó", "Silvia", "El Tambo"],
  "Cesar": ["Valledupar", "Aguachica", "Codazzi", "Bosconia", "La Paz", "San Diego"],
  "Chocó": ["Quibdó", "Istmina", "Condoto", "Bahía Solano", "Nuquí", "Acandí"],
  "Córdoba": ["Montería", "Cereté", "Lorica", "Tierralta", "Planeta Rica", "Sahagún", "Ciénaga de Oro", "Montelíbano"],
  "Cundinamarca": ["Bogotá D.C.", "Soacha", "Zipaquirá", "Chía", "Cajicá", "Facatativá", "Girardot", "Fusagasugá", "Mosquera", "Madrid", "La Calera", "Sopo", "Tocancipá"],
  "Guainía": ["Inírida", "Barrancominas", "Mapiripana", "San Felipe"],
  "Guaviare": ["San José del Guaviare", "El Retorno", "Calamar", "Miraflores"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata", "Gigante", "Campoalegre", "Palermo"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Manaure", "San Juan del Cesar", "Albania", "Barrancas"],
  "Magdalena": ["Santa Marta", "Ciénaga", "El Banco", "Fundación", "Plato", "Pivijay", "Aracataca"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López", "Restrepo", "San Martín", "Cabuyaro", "Cumaral"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales", "Túquerres", "Barbacoas", "La Unión", "Samaniego", "Tangua"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona", "Chinácota", "El Zulia"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Orito", "Puerto Caicedo", "Valle del Guamuez", "Villagarzón"],
  "Quindío": ["Armenia", "Calarcá", "La Tebaida", "Salento", "Montenegro", "Quimbaya", "Circasia", "Filandia", "Buenavista", "Córdoba", "Génova", "Pijao"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Belén de Umbría", "Quinchía", "Marsella", "Apía"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil", "Socorro", "Vélez", "Lebrija"],
  "Sucre": ["Sincelejo", "Corozal", "Sampués", "Tolú", "Sincé", "Morroa", "Coveñas"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Honda", "Chaparral", "Líbano", "Fresno", "Guamo"],
  "Valle del Cauca": ["Cali", "Palmira", "Buenaventura", "Tuluá", "Cartago", "Buga", "Jamundí", "Yumbo", "Candelaria", "Florida"],
  "Vaupés": ["Mitú", "Caruru", "Taraira", "Pacoa", "Papunaua"],
  "Vichada": ["Puerto Carreño", "Cumaribo", "La Primavera", "Santa Rosalía"]
};

function llenarCiudades(selDep, selCiu) {
  const primera = selCiu.dataset.placeholder || "Cualquier ciudad";
  selCiu.innerHTML = "";
  const op = document.createElement("option");
  op.textContent = primera;
  op.value = "";
  selCiu.appendChild(op);
  (DEPARTAMENTOS[selDep.value] || []).forEach(function (c) {
    const o = document.createElement("option");
    o.textContent = c;
    o.value = c;
    selCiu.appendChild(o);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-pais]").forEach(function (selDep) {
    const selCiu = document.getElementById(selDep.dataset.cascade);
    if (!selCiu) return;
    const primera = selDep.dataset.todos || "Todos los departamentos";
    const op = document.createElement("option");
    op.textContent = primera;
    op.value = "";
    selDep.appendChild(op);
    Object.keys(DEPARTAMENTOS).forEach(function (d) {
      const o = document.createElement("option");
      o.textContent = d;
      o.value = d;
      selDep.appendChild(o);
    });
    selDep.addEventListener("change", function () { llenarCiudades(selDep, selCiu); });
    const wrapper = selDep.closest(".hover-select");
    const trigger = wrapper ? wrapper.querySelector(".hsel-trigger span") : null;
    selCiu.addEventListener("change", function () {
      if (trigger) {
        trigger.textContent = selCiu.value ? selDep.value + " · " + selCiu.value : "Toda Colombia";
      }
    });
  });

  document.querySelectorAll("[data-hsel-panel]").forEach(function (panel) {
    const wrapper = panel.closest(".hover-select");
    const trigger = wrapper ? wrapper.querySelector(".hsel-trigger span") : null;
    const depList = panel.querySelector('[data-role="deptos"]');
    const ciuList = panel.querySelector('[data-role="ciudades"]');
    if (!depList || !ciuList) return;
    let depActual = "";

    function marcar(lista, btn) {
      lista.querySelectorAll(".hsel-opt.active").forEach(function (o) { o.classList.remove("active"); });
      btn.classList.add("active");
    }

    function pintarCiudades() {
      ciuList.innerHTML = "";
      const t = document.createElement("button");
      t.type = "button"; t.className = "hsel-opt";
      t.textContent = "Cualquier ciudad o municipio";
      t.addEventListener("click", function () {
        marcar(ciuList, t);
        panel.classList.remove("ciudad-on");
        if (trigger) trigger.textContent = depActual || "Toda Colombia";
      });
      ciuList.appendChild(t);
      (DEPARTAMENTOS[depActual] || []).forEach(function (c) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "hsel-opt";
        b.textContent = c;
        b.addEventListener("click", function () {
          marcar(ciuList, b);
          panel.classList.remove("ciudad-on");
          if (trigger) trigger.textContent = depActual + " · " + c;
        });
        ciuList.appendChild(b);
      });
    }

    function abrirDep(dep) {
      depActual = dep;
      pintarCiudades();
      panel.classList.add("ciudad-on");
    }

    const t = document.createElement("button");
    t.type = "button"; t.className = "hsel-opt";
    t.textContent = "Todos los departamentos";
    t.addEventListener("click", function () {
      marcar(depList, t);
      panel.classList.remove("ciudad-on");
      if (trigger) trigger.textContent = "Toda Colombia";
    });
    depList.appendChild(t);
    Object.keys(DEPARTAMENTOS).forEach(function (d) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "hsel-opt";
      b.textContent = d;
      b.addEventListener("mouseenter", function () { abrirDep(d); });
      b.addEventListener("focus", function () { abrirDep(d); });
      b.addEventListener("click", function () { marcar(depList, b); abrirDep(d); });
      depList.appendChild(b);
    });

    panel.addEventListener("mouseleave", function () { panel.classList.remove("ciudad-on"); });
  });

  document.querySelectorAll("[data-opts]").forEach(function (panel) {
    const wrapper = panel.closest(".hover-select");
    const trigger = wrapper ? wrapper.querySelector(".hsel-trigger span") : null;
    const list = panel.querySelector('[data-role="opciones"]');
    if (!list) return;
    JSON.parse(panel.dataset.opts).forEach(function (o, i) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hsel-opt" + (i === 0 ? " active" : "");
      b.textContent = o;
      b.addEventListener("click", function () {
        list.querySelectorAll(".hsel-opt.active").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (trigger) trigger.textContent = o;
      });
      list.appendChild(b);
    });
  });
});
