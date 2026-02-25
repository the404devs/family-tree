const container = document.getElementById("vis-container");
let network;
const options = {
    edges: {
      font: { size: 20, color: '#ffffff', strokeColor: '#000000' },
      width: 2,
      hoverWidth: 4,
      selectionWidth: 6,
      // edge shadows are super laggy
      shadow: true,
      smooth: {
        type: "cubicBezier",
        forceDirection: 'vertical'
      }
    },
    nodes: {
      labelHighlightBold: true,
    //   font: { size: 24, color: '#ffffff', background: 'rgba(0,0,0,0.75)' },
      font: { size: 18, color: '#000000', multi: 'md', ital: {size: 16, color: '#000000'}, bold: {size: 24, color: '#000000'} },
      color: {
        background: 'lightblue',
        border: 'black',
        highlight: {
          background: 'lightblue',
          border: 'black',
        },
        hover: {
          background: 'lightblue',
          border: 'black',
        }
      },
      size: 40,
      imagePadding: 10,
      shape: 'box',
      shadow: true
    },
    layout: {
      hierarchical: {
        sortMethod: 'directed', 
        direction: 'UD', 
        nodeSpacing: 200, 
        treeSpacing: 0, 
        levelSeparation: 200, 
        shakeTowards: 'leaves',
        parentCentralization: true,
        edgeMinimization: true,
        blockShifting: true,
      },
      randomSeed: 4,
      improvedLayout: true,
      clusterThreshold: 10
    },
    interaction: {
      hover: true,
      multiselect: true
    },
    physics: {
      enabled: true,
    //   solver: "forceAtlas2Based"
      hierarchicalRepulsion: {
        nodeDistance: 100,
        centralGravity: 0.1,
        springConstant: 0.02,
        damping: 1,
        avoidOverlap: 1
      }
    },
    configure: {
      enabled: false
    },
    groups: {
        junction: {
            labelHighlightBold: true,
            shape: 'box',
            color: {
                background: "lightgrey",
                border: "black",
                highlight: {
                    background: "lightgrey",
                    border: "black",
                },
                hover: {
                    background: "lightgrey",
                    border: "black",
                }
            },
            font: {
                color: 'black',
                background: 'transparent',
                size: 20,
                bold: true
            }
        },
        m: {
            labelHighlightBold: true,
            color: {
                background: "lightblue",
                border: "black",
                highlight: {
                    background: "lightblue",
                    border: "black",
                },
                hover: {
                    background: "lightblue",
                    border: "black",
                }
            },
        },
        f: {
            labelHighlightBold: true,
            color: {
                background: "pink",
                border: "black",
                highlight: {
                    background: "pink",
                    border: "black",
                },
                hover: {
                    background: "pink",
                    border: "black",
                }
            },
        },
    }
};

let people = [];
let relations = [];

function highlightNode(node) {
    network.selectNodes([node]);
    network.focus(node, {animation: true, scale: 1.5});
}

function highlightNodes(nodes) {
    network.selectNodes(nodes);

    const selectedEdges = network.getSelectedEdges();
    const selectedNodes = network.getSelectedNodes();
    let edgesToSelect = [];
    selectedEdges.forEach(edgeID => {
        let edge = edges.find(edge => edge.id === edgeID);
        if (selectedNodes.includes(edge.from) && selectedNodes.includes(edge.to)) {
            edgesToSelect.push(edgeID);
        }
    });

    network.setSelection({
        nodes: nodes,
        edges: edgesToSelect
    }, {
        unselectAll: true,
        highlightEdges: false
    });

    network.fit({nodes: nodes, animation: true, scale: 1.5});
}

const stationRoutes = {}
function generateStationRoutes() {
    let maxCost = 0;
    let maxPath = [];
    const startSelector = document.getElementById("start-display");
    const endSelector = document.getElementById("end-display");
    stations.map(station => {
        const opt = document.createElement("option");
        opt.value = station.id;
        opt.text = station.label;

        startSelector.appendChild(opt);
        endSelector.appendChild(opt.cloneNode(true))

        routes = dijkstra(station.id);
        stationRoutes[station.id] = {};
        routes.forEach(route => {
            stationRoutes[station.id][route[0]] = {
                "cost": route[1],
                "path": route[2],
                "costArr": route[3]
            };
            let totalCost = 0;
            for (i = 0; i < route[3].length; i++) {
                totalCost += route[3][i];
            }

            if (totalCost > maxCost) {
                maxCost = totalCost;
                maxPath = route[2];
            }
            
        });
    });

    // console.log(maxPath);
    document.getElementById('longest-path').onclick = () => {
        getBestRoute(maxPath[0], maxPath[maxPath.length-1]);
    };
    endSelector.value = stations[stations.length-1].id;
    return stationRoutes;

}

function calcBestRoute() {
    const start = document.getElementById("start-display").value;
    const end = document.getElementById("end-display").value;

    getBestRoute(start, end);
}

function reset() {
    const container = document.getElementById("path-display");
    container.textContent = "";
    network.unselectAll();
    network.fit({nodes: [], animation: true, scale: 1.5});
}

async function loadFromJson() {
    const response = await fetch("./data/people.json");
    const json = await response.json();
    data = generateNodesAndEdges(json.people, json.relations);

    network = new vis.Network(container, data, options);
    network.on("beforeDrawing", canvasLines);
    loadNodePositions();
}


function generateNodesAndEdges(people, relations) {
    
    let nodes = [];
    let edges = [];
    Object.keys(people).forEach(id => {
        const person = people[id];
        person.id = id;
        // Markdown formatted labels
        person.label = `*${person.primary}*\n${person.full}\n_${person.birth} ${person.death ? "—" : ""} ${person.death || ""}_`;
        person.group = person.gender;
        nodes.push(person);
    });
    console.log(`Adding ${Object.keys(people).length}`)
    Object.keys(people).forEach(person => {
        if (people[person].spouses) {
            people[person].spouses.forEach(spouse => {
                // avoid duplicate edges by only creating edge if spouse's id is greater than person's id
                if (spouse > person) return;
                // Create a junction node for the marriage
                const junctionId = `${person}-${spouse}`;
                junctionNode = {
                    id: junctionId,
                    label: '',
                    group: 'junction',
                    shape: 'box',
                    widthConstraint: 10,
                    heightConstraint: 10,
                    level: Math.max(people[person].level || 0, people[spouse].level || 0)
                };
                // Insert the junction node between the spouses
                const personIndex = nodes.findIndex(node => node.id === person);
                const spouseIndex = nodes.findIndex(node => node.id === spouse);
                const insertIndex = personIndex;
                console.log(`${personIndex} and ${spouseIndex} are spouses, inserting junction node ${junctionId} at index ${insertIndex}`);
                const spouseNode = nodes[spouseIndex];
                nodes.splice(spouseIndex, 1);
                nodes.splice(insertIndex, 0, junctionNode, spouseNode);
                // console.log(`Deleting ${nodes[spouseIndex].id}`)
                // Connect both spouses to the junction node
                edges.push({
                    from: person,
                    to: junctionId,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
                edges.push({
                    from: spouse,
                    to: junctionId,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
            });
        }

        if (people[person].parents) {
            // If two parents listed, point to a junction node between them and the child
            if (people[person].parents.length === 2) {
                const parent1 = people[person].parents[0];
                const parent2 = people[person].parents[1];
                // Find junction node for the parents' marriage
                let junctionId = `${parent1}-${parent2}`;
                if (!nodes.find(node => node.id === junctionId)) {
                    junctionId = `${parent2}-${parent1}`;
                }
                // Connect the child to the junction node
                edges.push({
                    from: junctionId,
                    to: person,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
                
            } else if (people[person].parents.length === 4) {
                // Edge case for Mary Gilstorf
                const parent1 = people[person].parents[0];
                const parent2 = people[person].parents[1];
                const parent3 = people[person].parents[2];
                const parent4 = people[person].parents[4];
                // Find junction node for the parents' marriage
                let junctionId = `${parent1}-${parent2}`;
                if (!nodes.find(node => node.id === junctionId)) {
                    junctionId = `${parent2}-${parent1}`;
                }
                // Connect the child to the junction node
                edges.push({
                    from: junctionId,
                    to: person,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
                edges.push({
                    from: parent3,
                    to: person,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
                edges.push({
                    from: parent4,
                    to: person,
                    arrows: 'to',
                    font: {align: 'middle'},
                });
            } else {
                people[person].parents.forEach(parent => {
                    const edge = {
                        from: parent,
                        to: person,
                        arrows: 'to',
                        font: {align: 'middle'},
                    };
                    edges.push(edge);
                });
            }
        }
    });

    // relations.forEach(relation => {
    //     const edge = {
    //         from: relation.from,
    //         to: relation.to,
    //         label: relation.type,
    //         arrows: 'to',
    //         font: {align: 'middle'},
    //     };
    //     edges.push(edge);
    // });
    console.log(edges);
    return {nodes: nodes, edges: edges};
}

function saveNodePositions() {
    localStorage.setItem("familytree-pos", JSON.stringify(network.getPositions()));
}

function loadNodePositions() {
    positions = JSON.parse(localStorage.getItem("familytree-pos"));
    Object.keys(positions).forEach(id => {
        const pos = positions[id];
        network.moveNode(id, pos.x, pos.y);
    });
}

function canvasLines() {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    let y = -700;
    while (y < 800) {
        ctx.moveTo(-10000, y);
        ctx.lineTo(10000, y);
        y += 200;
    }
    ctx.strokeStyle = "#444";
    ctx.stroke();
}

function exportPDF() {
    network.fit();
    setTimeout(() => {
        const canvas = document.querySelector("canvas");
        const imgData = canvas.toDataURL("image/png", 1.0)
        let pdf = new jspdf.jsPDF({orientation: "landscape", unit: "in", format: [17,11]});
        pdf.addImage(imgData, 'PNG', 0, 0);
        pdf.save("bowden.pdf");
    }, 1000);
}


loadFromJson();
