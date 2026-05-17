export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STOCK_ITEMS_SEED = [
  // BOXES
  { category: "Boxes", name: "4\" Square Box", lingo: "4 Square", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 1, variables: [] },
  { category: "Boxes", name: "4\" Square Box Deep", lingo: "4 Square Deep", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 2, variables: [] },
  { category: "Boxes", name: "4\" Octagon Box", lingo: "4 Oct", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 3, variables: [] },
  { category: "Boxes", name: "4\" Octagon Box Deep", lingo: "4 Oct Deep", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 4, variables: [] },
  { category: "Boxes", name: "Single Gang Old Work Metal", lingo: "Metal Old Work", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 5, variables: [] },
  { category: "Boxes", name: "Single Gang New Work Plastic", lingo: "Plastic New Work", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 6, variables: [] },
  { category: "Boxes", name: "2 Gang Old Work Plastic", lingo: "2 Gang Plastic Old Work", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 7, variables: [] },
  { category: "Boxes", name: "4\" Square Weatherproof Box", lingo: "WP Box", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 8, variables: [] },
  // MUD / PLASTER RINGS
  { category: "Mud / Plaster Rings", name: "Plaster Ring Single Gang", lingo: "1G Ring", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 10,
    variables: [{ key: "depth", label: "Depth", type: "select", options: ["Flat", "1/4\"", "1/2\"", "5/8\"", "3/4\"", "1\"", "Other"], required: true }] },
  { category: "Mud / Plaster Rings", name: "Plaster Ring Double Gang", lingo: "2G Ring", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 11,
    variables: [{ key: "depth", label: "Depth", type: "select", options: ["Flat", "1/4\"", "1/2\"", "5/8\"", "3/4\"", "1\"", "Other"], required: true }] },
  // EMT CONDUIT
  { category: "EMT Conduit", name: "EMT Conduit", lingo: "EMT", unitOfMeasure: "Sticks", defaultSupplier: "electrical", isConsumable: false, sortOrder: 20,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\"", "Custom"], required: true }] },
  // EMT FITTINGS
  { category: "EMT Fittings", name: "EMT Connector Set Screw", lingo: "SS Conn", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 30,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\""], required: true }] },
  { category: "EMT Fittings", name: "EMT Connector Compression", lingo: "Comp Conn", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 31,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\""], required: true }] },
  { category: "EMT Fittings", name: "EMT Connector Rain Tight", lingo: "RT Conn", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 32,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\""], required: true }] },
  { category: "EMT Fittings", name: "EMT Coupling", lingo: "Coupling", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 33,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\""], required: true }] },
  { category: "EMT Fittings", name: "EMT 90", lingo: "EMT 90", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 34,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\""], required: true }] },
  // MC / AC FITTINGS
  { category: "MC / AC Cable Fittings", name: "MC Cable Connector", lingo: "MC Conn", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 40,
    variables: [{ key: "size", label: "Size", type: "select", options: ["3/8\"", "1/2\"", "3/4\"", "1\""], required: true }] },
  // CONDUIT OTHER
  { category: "Conduit — Other Types", name: "Conduit", lingo: "Conduit", unitOfMeasure: "Sticks", defaultSupplier: "electrical", isConsumable: false, sortOrder: 50,
    variables: [
      { key: "type", label: "Type", type: "select", options: ["EMT", "Sched 40 PVC", "Sched 80 PVC", "IMC", "Rigid", "Flex", "NM LT", "Metallic LT"], required: true },
      { key: "size", label: "Size", type: "select", options: ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\"", "4\"", "Custom"], required: true },
    ] },
  // WIRE & CABLE
  { category: "Wire & Cable", name: "THHN/THWN Wire", lingo: "THHN", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 60,
    variables: [
      { key: "size", label: "Wire Size", type: "select", options: ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250MCM", "350MCM", "500MCM", "Custom"], required: true },
      { key: "material", label: "CU / AL", type: "select", options: ["CU", "AL"], required: true },
      { key: "color", label: "Color", type: "select", options: ["Black", "Red", "Blue", "White", "Green", "Brown", "Orange", "Yellow", "Gray", "Other"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["500ft", "1000ft", "2500ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "XHHW Wire", lingo: "XHHW", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 61,
    variables: [
      { key: "size", label: "Wire Size", type: "select", options: ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250MCM", "350MCM", "500MCM", "Custom"], required: true },
      { key: "material", label: "CU / AL", type: "select", options: ["CU", "AL"], required: true },
      { key: "color", label: "Color", type: "select", options: ["Black", "Red", "Blue", "White", "Green", "Brown", "Orange", "Yellow", "Gray", "Other"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["500ft", "1000ft", "2500ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "MC Cable", lingo: "MC", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 62,
    variables: [
      { key: "size", label: "Size / Conductors", type: "select", options: ["12/2", "12/3", "14/2", "14/3", "10/2", "10/3", "8/3", "6/3", "Custom"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["250ft", "1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "Romex NM-B", lingo: "Romex", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 63,
    variables: [
      { key: "size", label: "Size / Conductors", type: "select", options: ["12/2", "12/3", "14/2", "14/3", "10/2", "10/3", "8/3", "6/3", "Custom"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["250ft", "1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "FPLR Fire Alarm Cable", lingo: "FPLR", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 64,
    variables: [
      { key: "size", label: "Size", type: "text", placeholder: "e.g. 16/2", required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["250ft", "1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "FPLP Fire Alarm Cable Plenum", lingo: "FPLP", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 65,
    variables: [
      { key: "size", label: "Size", type: "text", placeholder: "e.g. 16/2", required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["250ft", "1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "Cat6", lingo: "Cat6", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 66,
    variables: [
      { key: "plenum", label: "Type", type: "select", options: ["Non-Plenum", "Plenum"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "Cat5e", lingo: "Cat5e", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 67,
    variables: [
      { key: "plenum", label: "Type", type: "select", options: ["Non-Plenum", "Plenum"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["1000ft", "Custom"], required: true },
    ] },
  { category: "Wire & Cable", name: "Speaker Wire", lingo: "Speaker Wire", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: false, sortOrder: 68,
    variables: [
      { key: "gauge", label: "Gauge", type: "text", placeholder: "e.g. 16AWG", required: true },
      { key: "rollSize", label: "Roll Size", type: "text", placeholder: "e.g. 500ft", required: true },
    ] },
  // WIRE CONNECTORS
  { category: "Wire Connectors", name: "Wire Nut", lingo: "Wire Nut", unitOfMeasure: "Bag", defaultSupplier: "electrical", isConsumable: true, sortOrder: 70,
    variables: [{ key: "color", label: "Color", type: "text", placeholder: "e.g. Orange, Yellow, Red", required: true }] },
  { category: "Wire Connectors", name: "Wago Push-In Connector", lingo: "Wago", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 71,
    variables: [{ key: "ports", label: "Ports", type: "select", options: ["2", "3", "4", "5", "6", "8"], required: true }] },
  // GROUNDING
  { category: "Grounding", name: "Ground Rod", lingo: "Ground Rod", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 80,
    variables: [
      { key: "size", label: "Diameter", type: "select", options: ["1/2\"", "5/8\""], required: true },
      { key: "length", label: "Length", type: "select", options: ["4ft", "8ft"], required: true },
    ] },
  { category: "Grounding", name: "Ground Rod Clamp (Acorn)", lingo: "Acorn Clamp", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 81,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"", "5/8\""], required: true }] },
  { category: "Grounding", name: "Ground Bar", lingo: "Ground Bar", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 82,
    variables: [
      { key: "spaces", label: "Spaces", type: "text", placeholder: "e.g. 20", required: true },
      { key: "manufacturer", label: "Manufacturer Preference", type: "text", placeholder: "e.g. Square D" },
    ] },
  // STAPLES & FASTENERS
  { category: "Staples & Fasteners", name: "Staples", lingo: "Staples", unitOfMeasure: "Box", defaultSupplier: "electrical", isConsumable: true, sortOrder: 90,
    variables: [{ key: "type", label: "Type", type: "select", options: ["BRP SN-300 3/4\"", "Insulated SN40IB Reds", "Custom"], required: true }] },
  { category: "Staples & Fasteners", name: "Drywall Screws", lingo: "Screws", unitOfMeasure: "Box", defaultSupplier: "electrical", isConsumable: true, sortOrder: 91,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 1-5/8\" coarse", required: true }] },
  { category: "Staples & Fasteners", name: "Toggle Bolts", lingo: "Toggles", unitOfMeasure: "Box", defaultSupplier: "electrical", isConsumable: true, sortOrder: 92,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/16\" x 3\"", required: true }] },
  { category: "Staples & Fasteners", name: "Tapcons", lingo: "Tapcons", unitOfMeasure: "Box", defaultSupplier: "electrical", isConsumable: true, sortOrder: 93,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/16\" x 1-3/4\"", required: true }] },
  // PANELS & BREAKERS
  { category: "Panels & Breakers", name: "Distribution Panel", lingo: "Panel", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 100,
    variables: [{ key: "description", label: "Description", type: "text", placeholder: "e.g. 42ckt Square D QO bolt-on MCB", required: true }],
    notes: "Quoted item" },
  { category: "Panels & Breakers", name: "Breaker", lingo: "Breaker", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 101,
    variables: [
      { key: "brand", label: "Brand", type: "text", placeholder: "e.g. Square D, Eaton", required: true },
      { key: "poles", label: "Poles", type: "select", options: ["1", "2", "3"], required: true },
      { key: "volts", label: "Volts", type: "select", options: ["120", "240", "277", "480"], required: true },
      { key: "amps", label: "Amps", type: "text", placeholder: "e.g. 20", required: true },
      { key: "mountType", label: "Type", type: "select", options: ["Plug-on", "Bolt-on"], required: true },
    ],
    notes: "Quoted item" },
  // DEVICES & RECEPTACLES
  { category: "Devices & Receptacles", name: "Receptacle", lingo: "Recep", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 110,
    variables: [
      { key: "voltage", label: "Voltage", type: "select", options: ["120V", "240V"], required: true },
      { key: "amps", label: "Amps", type: "select", options: ["15A", "20A"], required: true },
      { key: "type", label: "Type", type: "select", options: ["Duplex", "Single"], required: true },
      { key: "protection", label: "Protection", type: "select", options: ["Standard", "GFCI", "AFCI"], required: true },
      { key: "tamperResistant", label: "Tamper Resistant", type: "select", options: ["Standard", "Tamper Resistant"], required: false },
      { key: "weatherproof", label: "Weatherproof", type: "select", options: ["Indoor", "Weatherproof"], required: false },
      { key: "color", label: "Color", type: "select", options: ["White", "Ivory", "Black", "Gray"], required: true },
    ] },
  { category: "Devices & Receptacles", name: "Switch", lingo: "Switch", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 111,
    variables: [
      { key: "amps", label: "Amps", type: "select", options: ["15A", "20A"], required: true },
      { key: "poles", label: "Poles", type: "select", options: ["Single Pole", "3-Way", "4-Way"], required: true },
      { key: "style", label: "Style", type: "select", options: ["Standard", "Decorator"], required: true },
      { key: "color", label: "Color", type: "select", options: ["White", "Ivory", "Black", "Gray"], required: true },
    ] },
  { category: "Devices & Receptacles", name: "Dimmer", lingo: "Dimmer", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 112,
    variables: [
      { key: "type", label: "Type", type: "text", placeholder: "e.g. Lutron Diva LED+", required: true },
      { key: "color", label: "Color", type: "select", options: ["White", "Ivory", "Black", "Gray", "Other"], required: true },
    ] },
  // LIGHTING
  { category: "Lighting", name: "Light Fixture", lingo: "Fixture", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 120,
    variables: [{ key: "description", label: "Description", type: "text", placeholder: "e.g. 2x4 LED troffer, 4000K", required: true }],
    notes: "Quoted item" },
  { category: "Lighting", name: "LED Strip Light", lingo: "LED Strip", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 121,
    variables: [{ key: "description", label: "Size and Type", type: "text", placeholder: "e.g. 4ft, 5000K surface mount", required: true }] },
  // TAPE & SEALANTS
  { category: "Tape & Sealants", name: "Electrical Tape", lingo: "Elec Tape", unitOfMeasure: "Rolls", defaultSupplier: "electrical", isConsumable: true, sortOrder: 130,
    variables: [{ key: "color", label: "Color", type: "select", options: ["Black", "White", "Red", "Blue", "Green", "Other"], required: true }] },
  { category: "Tape & Sealants", name: "Fire Stop (3M CP 25WB+)", lingo: "Fire Stop", unitOfMeasure: "Tubes", defaultSupplier: "electrical", isConsumable: true, sortOrder: 131, variables: [] },
  { category: "Tape & Sealants", name: "Duct Seal (DSC1)", lingo: "Duct Seal", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: true, sortOrder: 132, variables: [] },
  // MISC HARDWARE
  { category: "Misc Hardware & Specialty", name: "CJ6 Colorado Jim", lingo: "CJ6", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 140, variables: [] },
  { category: "Misc Hardware & Specialty", name: "Madison Bars", lingo: "Madison Bars", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 141, variables: [] },
  { category: "Misc Hardware & Specialty", name: "Zip Its", lingo: "Zip Its", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 142, variables: [] },
  { category: "Misc Hardware & Specialty", name: "Baldy / Changeover", lingo: "Baldy", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 143,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/4\"", required: true }] },
  { category: "Misc Hardware & Specialty", name: "Click It Strap", lingo: "Click It", unitOfMeasure: "EA", defaultSupplier: "electrical", isConsumable: false, sortOrder: 144,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/4\"", required: true }] },
  // CONSUMABLES & SAFETY
  { category: "Consumables & Safety", name: "Drill Bits", lingo: "Drill Bits", unitOfMeasure: "EA", isConsumable: true, sortOrder: 150,
    variables: [
      { key: "type", label: "Type & Size", type: "text", placeholder: "e.g. 3/4\" spade, 1/2\" SDS", required: true },
    ] },
  { category: "Consumables & Safety", name: "Hole Saw", lingo: "Hole Saw", unitOfMeasure: "EA", isConsumable: true, sortOrder: 151,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 4-1/2\"", required: true }] },
  { category: "Consumables & Safety", name: "SDS Bits", lingo: "SDS", unitOfMeasure: "EA", isConsumable: true, sortOrder: 152,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/4\" x 18\"", required: true }] },
  { category: "Consumables & Safety", name: "Gloves", lingo: "Gloves", unitOfMeasure: "Pairs", isConsumable: true, sortOrder: 153,
    variables: [{ key: "size", label: "Size", type: "select", options: ["S", "M", "L", "XL"], required: true }] },
  { category: "Consumables & Safety", name: "Safety Glasses", lingo: "Safety Glasses", unitOfMeasure: "EA", isConsumable: true, sortOrder: 154, variables: [] },
  { category: "Consumables & Safety", name: "Hard Hats", lingo: "Hard Hat", unitOfMeasure: "EA", isConsumable: true, sortOrder: 155, variables: [] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NEW_STOCK_ITEMS: any[] = [
  // WIRE & CABLE additions
  { category: "Wire & Cable", name: "SIMpull THHN Wire", lingo: "SIMpull", unitOfMeasure: "FT", isConsumable: false, sortOrder: 69,
    variables: [
      { key: "size", label: "Wire Size", type: "select", options: ["14","12","10","8","6","4","3","2","1","1/0","2/0","3/0","4/0","250MCM","350MCM","500MCM"], required: true },
      { key: "color", label: "Color", type: "select", options: ["Black","Red","Blue","White","Green","Brown","Orange","Yellow","Gray","Other"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 250", required: true },
    ], notes: "SIMpull low-friction coating" },
  { category: "Wire & Cable", name: "USE-2 Wire", lingo: "USE-2", unitOfMeasure: "FT", isConsumable: false, sortOrder: 70,
    variables: [
      { key: "size", label: "Wire Size", type: "select", options: ["14","12","10","8","6","4","2","1/0","2/0","4/0"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 100", required: true },
    ] },
  { category: "Wire & Cable", name: "UF-B Cable", lingo: "UF-B", unitOfMeasure: "Rolls", isConsumable: false, sortOrder: 71,
    variables: [
      { key: "size", label: "Gauge/Conductors", type: "select", options: ["14/2","12/2","10/2"], required: true },
      { key: "rollSize", label: "Roll Size", type: "select", options: ["250ft","400ft"], required: true },
    ] },
  { category: "Wire & Cable", name: "Telephone Wire", lingo: "Tel Wire", unitOfMeasure: "FT", isConsumable: false, sortOrder: 72,
    variables: [
      { key: "gauge", label: "Gauge", type: "text", placeholder: "e.g. 24 AWG 4-pair", required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 100", required: true },
    ] },
  { category: "Wire & Cable", name: "Coax RG6", lingo: "Coax", unitOfMeasure: "FT", isConsumable: false, sortOrder: 73,
    variables: [
      { key: "qty", label: "Footage or Reel", type: "select", options: ["By the foot","500ft reel"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 100" },
    ] },
  { category: "Wire & Cable", name: "HDMI Cable", lingo: "HDMI", unitOfMeasure: "EA", isConsumable: false, sortOrder: 74,
    variables: [
      { key: "length", label: "Length", type: "text", placeholder: "e.g. 6ft, 25ft", required: true },
    ] },
  // LOW VOLTAGE
  { category: "Low Voltage", name: "18/2 Thermostat Wire", lingo: "T-Stat Wire", unitOfMeasure: "FT", isConsumable: false, sortOrder: 200,
    variables: [
      { key: "qty", label: "Footage or Coil", type: "select", options: ["By the foot","50ft coil","100ft coil"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 75" },
    ] },
  { category: "Low Voltage", name: "22/4 Alarm Wire", lingo: "Alarm Wire", unitOfMeasure: "FT", isConsumable: false, sortOrder: 201,
    variables: [
      { key: "qty", label: "Footage or Reel", type: "select", options: ["By the foot","500ft reel"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 200" },
    ] },
  { category: "Low Voltage", name: "18/8 Control Wire", lingo: "Control Wire", unitOfMeasure: "FT", isConsumable: false, sortOrder: 202,
    variables: [
      { key: "qty", label: "Footage or Reel", type: "select", options: ["By the foot","500ft reel"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 200" },
    ] },
  // EMT FITTINGS additions
  { category: "EMT Fittings", name: "Reducing Coupling", lingo: "Reducing Coupling", unitOfMeasure: "EA", isConsumable: false, sortOrder: 35,
    variables: [
      { key: "sizeFrom", label: "From Size", type: "select", options: ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","4\""], required: true },
      { key: "sizeTo", label: "To Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\""], required: true },
      { key: "type", label: "Type", type: "select", options: ["EMT","Rigid"], required: true },
    ] },
  { category: "EMT Fittings", name: "Expansion Coupling", lingo: "Exp Coupling", unitOfMeasure: "EA", isConsumable: false, sortOrder: 36,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""], required: true }] },
  { category: "EMT Fittings", name: "LB Conduit Body", lingo: "LB", unitOfMeasure: "EA", isConsumable: false, sortOrder: 37,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""], required: true }] },
  { category: "EMT Fittings", name: "LL Conduit Body", lingo: "LL", unitOfMeasure: "EA", isConsumable: false, sortOrder: 38,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""], required: true }] },
  { category: "EMT Fittings", name: "LR Conduit Body", lingo: "LR", unitOfMeasure: "EA", isConsumable: false, sortOrder: 39,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""], required: true }] },
  { category: "EMT Fittings", name: "T Conduit Body", lingo: "T Body", unitOfMeasure: "EA", isConsumable: false, sortOrder: 40,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""], required: true }] },
  { category: "EMT Fittings", name: "Conduit Strap 1-Hole", lingo: "1-Hole Strap", unitOfMeasure: "EA", isConsumable: false, sortOrder: 41,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","4\""], required: true }] },
  { category: "EMT Fittings", name: "Conduit Strap 2-Hole", lingo: "2-Hole Strap", unitOfMeasure: "EA", isConsumable: false, sortOrder: 42,
    variables: [{ key: "size", label: "Size", type: "select", options: ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","4\""], required: true }] },
  { category: "EMT Fittings", name: "Beam Clamp", lingo: "Beam Clamp", unitOfMeasure: "EA", isConsumable: false, sortOrder: 43,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/8\"", required: true }] },
  // BOXES additions
  { category: "Boxes", name: "Weatherproof In-Use Cover", lingo: "WP In-Use", unitOfMeasure: "EA", isConsumable: false, sortOrder: 9,
    variables: [
      { key: "gangs", label: "Gangs", type: "select", options: ["1-Gang","2-Gang"], required: true },
      { key: "type", label: "Type", type: "select", options: ["Single","Duplex"], required: true },
    ] },
  { category: "Boxes", name: "Weatherproof Bubble Cover", lingo: "WP Bubble", unitOfMeasure: "EA", isConsumable: false, sortOrder: 10,
    variables: [{ key: "gangs", label: "Gangs", type: "select", options: ["1-Gang","2-Gang"], required: true }] },
  { category: "Boxes", name: "Junction Box 6x6x4", lingo: "6x6 JBox", unitOfMeasure: "EA", isConsumable: false, sortOrder: 11, variables: [] },
  { category: "Boxes", name: "Junction Box 8x8x4", lingo: "8x8 JBox", unitOfMeasure: "EA", isConsumable: false, sortOrder: 12, variables: [] },
  { category: "Boxes", name: "Pull Box", lingo: "Pull Box", unitOfMeasure: "EA", isConsumable: false, sortOrder: 13,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 12x12x6", required: true }] },
  // DEVICES additions
  { category: "Devices & Receptacles", name: "USB Receptacle", lingo: "USB Recep", unitOfMeasure: "EA", isConsumable: false, sortOrder: 113,
    variables: [
      { key: "type", label: "USB Type", type: "select", options: ["Type A","Type C","Type A+C"], required: true },
      { key: "color", label: "Color", type: "select", options: ["White","Ivory","Black","Gray"], required: true },
    ] },
  { category: "Devices & Receptacles", name: "Range Receptacle 50A", lingo: "Range Recep", unitOfMeasure: "EA", isConsumable: false, sortOrder: 114, variables: [] },
  { category: "Devices & Receptacles", name: "Dryer Receptacle 30A", lingo: "Dryer Recep", unitOfMeasure: "EA", isConsumable: false, sortOrder: 115, variables: [] },
  { category: "Devices & Receptacles", name: "EV Outlet 14-50", lingo: "EV Outlet", unitOfMeasure: "EA", isConsumable: false, sortOrder: 116, variables: [] },
  { category: "Devices & Receptacles", name: "Photocell", lingo: "Photocell", unitOfMeasure: "EA", isConsumable: false, sortOrder: 117,
    variables: [{ key: "type", label: "Type", type: "text", placeholder: "e.g. twist-lock, swivel", required: true }] },
  { category: "Devices & Receptacles", name: "Timer Switch", lingo: "Timer", unitOfMeasure: "EA", isConsumable: false, sortOrder: 118,
    variables: [{ key: "type", label: "Type", type: "text", placeholder: "e.g. 7-day programmable", required: true }] },
  // GROUNDING additions
  { category: "Grounding", name: "Ground Rod 5/8\" x 8ft", lingo: "Ground Rod 5/8", unitOfMeasure: "EA", isConsumable: false, sortOrder: 83, variables: [] },
  { category: "Grounding", name: "Ground Wire Bare Copper", lingo: "Bare CU", unitOfMeasure: "FT", isConsumable: false, sortOrder: 84,
    variables: [
      { key: "size", label: "Wire Size", type: "select", options: ["14","12","10","8","6","4","2","1/0","4/0"], required: true },
      { key: "footage", label: "Footage (ft)", type: "text", placeholder: "e.g. 50", required: true },
    ] },
  { category: "Grounding", name: "Irreversible Compression Lug", lingo: "Comp Lug", unitOfMeasure: "EA", isConsumable: false, sortOrder: 85,
    variables: [{ key: "size", label: "Wire Size", type: "text", placeholder: "e.g. 4/0 CU", required: true }] },
  // STRUT & HANGERS
  { category: "Strut & Hangers", name: "Strut 1-5/8\" x 10ft", lingo: "Unistrut", unitOfMeasure: "EA", isConsumable: false, sortOrder: 300, variables: [] },
  { category: "Strut & Hangers", name: "Strut 13/16\" x 10ft", lingo: "Mini Strut", unitOfMeasure: "EA", isConsumable: false, sortOrder: 301, variables: [] },
  { category: "Strut & Hangers", name: "Strut Nut", lingo: "Strut Nut", unitOfMeasure: "EA", isConsumable: false, sortOrder: 302,
    variables: [{ key: "size", label: "Size", type: "select", options: ["3/8\"","1/2\""], required: true }] },
  { category: "Strut & Hangers", name: "Strut Bolt", lingo: "Strut Bolt", unitOfMeasure: "EA", isConsumable: false, sortOrder: 303,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/8\" x 1\"", required: true }] },
  { category: "Strut & Hangers", name: "Threaded Rod", lingo: "All-Thread", unitOfMeasure: "EA", isConsumable: false, sortOrder: 304,
    variables: [
      { key: "size", label: "Diameter", type: "text", placeholder: "e.g. 3/8\", 1/2\"", required: true },
      { key: "length", label: "Length", type: "text", placeholder: "e.g. 10ft", required: true },
    ] },
  { category: "Strut & Hangers", name: "Threaded Rod Coupling", lingo: "Rod Coupling", unitOfMeasure: "EA", isConsumable: false, sortOrder: 305,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/8\"", required: true }] },
  { category: "Strut & Hangers", name: "Kindorf Hanger", lingo: "Kindorf", unitOfMeasure: "EA", isConsumable: false, sortOrder: 306,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 3/4\" EMT", required: true }] },
  // CONSUMABLES & SAFETY additions
  { category: "Consumables & Safety", name: "Pencil/Marker", lingo: "Marker", unitOfMeasure: "EA", isConsumable: true, sortOrder: 156,
    variables: [{ key: "type", label: "Type", type: "text", placeholder: "e.g. lumber pencil, Sharpie", required: true }] },
  { category: "Consumables & Safety", name: "Chalk Line", lingo: "Chalk Line", unitOfMeasure: "EA", isConsumable: true, sortOrder: 157, variables: [] },
  { category: "Consumables & Safety", name: "Measuring Tape", lingo: "Tape Measure", unitOfMeasure: "EA", isConsumable: true, sortOrder: 158,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 25ft, 35ft", required: true }] },
  { category: "Consumables & Safety", name: "Level", lingo: "Level", unitOfMeasure: "EA", isConsumable: true, sortOrder: 159,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 4ft, 2ft", required: true }] },
  { category: "Consumables & Safety", name: "Utility Knife Blades", lingo: "Blades", unitOfMeasure: "PK", isConsumable: true, sortOrder: 160, variables: [] },
  { category: "Consumables & Safety", name: "Wire Pulling Lubricant", lingo: "Lube", unitOfMeasure: "EA", isConsumable: true, sortOrder: 161,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. quart, gallon", required: true }] },
  { category: "Consumables & Safety", name: "Penetrating Oil", lingo: "Penetrating Oil", unitOfMeasure: "EA", isConsumable: true, sortOrder: 162, variables: [] },
  { category: "Consumables & Safety", name: "Hand Cleaner", lingo: "Hand Cleaner", unitOfMeasure: "EA", isConsumable: true, sortOrder: 163, variables: [] },
  { category: "Consumables & Safety", name: "First Aid Kit", lingo: "First Aid", unitOfMeasure: "EA", isConsumable: true, sortOrder: 164, variables: [] },
  { category: "Consumables & Safety", name: "Hearing Protection", lingo: "Ear Plugs", unitOfMeasure: "Pairs", isConsumable: true, sortOrder: 165, variables: [] },
  { category: "Consumables & Safety", name: "Knee Pads", lingo: "Knee Pads", unitOfMeasure: "Pairs", isConsumable: true, sortOrder: 166, variables: [] },
  { category: "Consumables & Safety", name: "Work Boots", lingo: "Boots", unitOfMeasure: "Pairs", isConsumable: true, sortOrder: 167,
    variables: [{ key: "size", label: "Size", type: "text", placeholder: "e.g. 11", required: true }] },
  { category: "Consumables & Safety", name: "Hi-Vis Vest", lingo: "Safety Vest", unitOfMeasure: "EA", isConsumable: true, sortOrder: 168,
    variables: [{ key: "size", label: "Size", type: "select", options: ["S","M","L","XL","2XL"], required: true }] },
];

async function seedStockItems() {
  const count = await prisma.stockItem.count();
  if (count === 0) {
    for (const item of STOCK_ITEMS_SEED) {
      await prisma.stockItem.create({ data: item });
    }
  }
}

async function seedNewItems() {
  for (const item of NEW_STOCK_ITEMS) {
    const existing = await prisma.stockItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.stockItem.create({ data: item });
    }
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  await seedStockItems();
  await seedNewItems();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q")?.toLowerCase();

  const items = await prisma.stockItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const filtered = search
    ? items.filter(i =>
        i.name.toLowerCase().includes(search) ||
        (i.lingo?.toLowerCase().includes(search)) ||
        i.category.toLowerCase().includes(search)
      )
    : items;

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const item = await prisma.stockItem.create({ data: body });
  return NextResponse.json(item);
}
