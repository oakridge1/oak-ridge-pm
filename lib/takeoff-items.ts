export type StdItem = {
  key: string;
  label: string;
  category: string;
  symId: string;
  unit: "ea" | "ft";
  bomId?: string;
};

export const STD_ITEMS: StdItem[] = [
  // DEVICES
  { key: "recept_20a",    label: "20A Receptacle",       category: "Devices",  symId: "duplex_recept", unit: "ea" },
  { key: "recept_15a_tr", label: "15A TR Receptacle",    category: "Devices",  symId: "duplex_recept", unit: "ea" },
  { key: "gfci_20a",      label: "GFCI 20A",             category: "Devices",  symId: "gfci_recept",   unit: "ea" },
  { key: "gfci_15a_tr",   label: "GFCI 15A TR",          category: "Devices",  symId: "gfci_recept",   unit: "ea" },
  { key: "switch_sp",     label: "Single Pole Switch",   category: "Devices",  symId: "sp_switch",     unit: "ea" },
  { key: "switch_3way",   label: "3-Way Switch",         category: "Devices",  symId: "3way_switch",   unit: "ea" },
  { key: "dimmer",        label: "Dimmer",               category: "Devices",  symId: "dimmer_sw",     unit: "ea" },
  { key: "dimmer_010v",   label: "0-10V Dimmer",         category: "Devices",  symId: "dimmer_sw",     unit: "ea" },
  { key: "occ_sensor",    label: "Occupancy Sensor",     category: "Devices",  symId: "ceil_fixture",  unit: "ea" },
  { key: "wp_cover",      label: "WP Cover",             category: "Devices",  symId: "wp_recept",     unit: "ea" },
  // FIXTURES
  { key: "fixture_2x4",      label: "2x4 Troffer",       category: "Fixtures", symId: "fluor_fixture", unit: "ea" },
  { key: "fixture_2x2",      label: "2x2 Troffer",       category: "Fixtures", symId: "fluor_fixture", unit: "ea" },
  { key: "fixture_strip",    label: "Strip Fixture",     category: "Fixtures", symId: "fluor_fixture", unit: "ea" },
  { key: "fixture_wallpack", label: "Wall Pack",         category: "Fixtures", symId: "wall_fixture",  unit: "ea" },
  { key: "fixture_exit_ebu", label: "Exit/Emergency",    category: "Fixtures", symId: "exit_light",    unit: "ea" },
  { key: "fixture_highbay",  label: "High Bay",          category: "Fixtures", symId: "high_bay",      unit: "ea" },
  { key: "fixture_ceilfan",  label: "Ceiling Fan",       category: "Fixtures", symId: "ceil_fan",      unit: "ea" },
  { key: "fixture_recessed", label: "Recessed Can",      category: "Fixtures", symId: "recessed",      unit: "ea" },
  { key: "fixture_wall",     label: "Wall Fixture",      category: "Fixtures", symId: "wall_fixture",  unit: "ea" },
  // DATA
  { key: "data_1port", label: "Data 1-Port", category: "Data", symId: "data_port", unit: "ea" },
  { key: "data_2port", label: "Data 2-Port", category: "Data", symId: "data_port", unit: "ea" },
  { key: "data_3port", label: "Data 3-Port", category: "Data", symId: "data_port", unit: "ea" },
  { key: "data_4port", label: "Data 4-Port", category: "Data", symId: "data_port", unit: "ea" },
  // PANELS
  { key: "panel_comm_sm", label: "Panel Small",  category: "Panels", symId: "panel_box", unit: "ea" },
  { key: "panel_comm_md", label: "Panel Medium", category: "Panels", symId: "panel_box", unit: "ea" },
  { key: "panel_comm_lg", label: "Panel Large",  category: "Panels", symId: "panel_box", unit: "ea" },
  { key: "xfmr_sm",  label: "Transformer Small",  category: "Panels", symId: "xfmr", unit: "ea" },
  { key: "xfmr_md",  label: "Transformer Medium", category: "Panels", symId: "xfmr", unit: "ea" },
  { key: "xfmr_lg",  label: "Transformer Large",  category: "Panels", symId: "xfmr", unit: "ea" },
  { key: "lc_100a",  label: "Load Center 100A",   category: "Panels", symId: "panel_box", unit: "ea" },
  { key: "lc_200a",  label: "Load Center 200A",   category: "Panels", symId: "panel_box", unit: "ea" },
  // FIRE ALARM
  { key: "fa_smoke",       label: "Smoke Detector",      category: "Fire Alarm", symId: "smoke_det",    unit: "ea" },
  { key: "fa_heat",        label: "Heat Detector",       category: "Fire Alarm", symId: "smoke_det",    unit: "ea" },
  { key: "fa_smoke_co",    label: "Smoke/CO Combo",      category: "Fire Alarm", symId: "smoke_det",    unit: "ea" },
  { key: "fa_pull",        label: "Pull Station",        category: "Fire Alarm", symId: "junction_box", unit: "ea" },
  { key: "fa_horn_strobe", label: "Horn/Strobe",         category: "Fire Alarm", symId: "exit_light",   unit: "ea" },
  { key: "fa_strobe",      label: "Strobe",              category: "Fire Alarm", symId: "exit_light",   unit: "ea" },
  { key: "fa_lf_sounder",  label: "LF Sounder",         category: "Fire Alarm", symId: "exit_light",   unit: "ea" },
  { key: "fa_beacon",      label: "Beacon",              category: "Fire Alarm", symId: "ceil_fixture", unit: "ea" },
  { key: "fa_ctrl_mod",    label: "Control Module",      category: "Fire Alarm", symId: "junction_box", unit: "ea" },
  { key: "fa_duct_smoke",  label: "Duct Smoke",          category: "Fire Alarm", symId: "smoke_det",    unit: "ea" },
  { key: "fa_panel_sm",    label: "FA Panel Small",      category: "Fire Alarm", symId: "panel_box",    unit: "ea" },
  { key: "fa_panel_md",    label: "FA Panel Medium",     category: "Fire Alarm", symId: "panel_box",    unit: "ea" },
  { key: "fa_panel_lg",    label: "FA Panel Large",      category: "Fire Alarm", symId: "panel_box",    unit: "ea" },
  { key: "fa_radio",       label: "FA Radio",            category: "Fire Alarm", symId: "junction_box", unit: "ea" },
  { key: "fa_annun",       label: "FA Annunciator",      category: "Fire Alarm", symId: "panel_box",    unit: "ea" },
  // BOXES & ROUGH
  { key: "box_4sq_deep", label: '4" Square Box',    category: "Boxes & Rough", symId: "junction_box", unit: "ea" },
  { key: "can_sm",       label: "Recessed Can Sm",  category: "Boxes & Rough", symId: "junction_box", unit: "ea" },
  { key: "can_md",       label: "Recessed Can Md",  category: "Boxes & Rough", symId: "junction_box", unit: "ea" },
  { key: "can_lg",       label: "Recessed Can Lg",  category: "Boxes & Rough", symId: "junction_box", unit: "ea" },
  { key: "can_xl",       label: "Recessed Can XL",  category: "Boxes & Rough", symId: "junction_box", unit: "ea" },
  // MC HOME RUNS (footage)
  { key: "mc_homerun_12", label: "MC Home Run #12", category: "Conduit", symId: "dot", unit: "ft" },
  { key: "mc_homerun_10", label: "MC Home Run #10", category: "Conduit", symId: "dot", unit: "ft" },
  { key: "mc_homerun_8",  label: "MC Home Run #8",  category: "Conduit", symId: "dot", unit: "ft" },
  // LOW VOLTAGE
  { key: "sec_camera",    label: "Security Camera",  category: "Low Voltage / Misc", symId: "ceil_fixture",  unit: "ea" },
  { key: "access_reader", label: "Access Reader",    category: "Low Voltage / Misc", symId: "junction_box",  unit: "ea" },
  { key: "intercom",      label: "Intercom",         category: "Low Voltage / Misc", symId: "telephone",     unit: "ea" },
  { key: "av_outlet",     label: "A/V Outlet",       category: "Low Voltage / Misc", symId: "data_port",     unit: "ea" },
  { key: "speaker",       label: "Speaker",          category: "Low Voltage / Misc", symId: "ceil_fixture",  unit: "ea" },
  { key: "doorbell",      label: "Doorbell",         category: "Low Voltage / Misc", symId: "junction_box",  unit: "ea" },
];

export const CAT_COLORS: Record<string, string> = {
  "Devices":            "#e03a3a",
  "Fixtures":           "#3a8fe8",
  "Data":               "#2db562",
  "Conduit":            "#f0a500",
  "Panels":             "#b03ae0",
  "Fire Alarm":         "#e03a99",
  "Boxes & Rough":      "#e0773a",
  "Low Voltage / Misc": "#3adde0",
  "Custom":             "#9aa0ab",
};

export const CATEGORY_TABS: { id: string; label: string; categories: string[] }[] = [
  { id: "devices",  label: "Devices",  categories: ["Devices"] },
  { id: "fixtures", label: "Fixtures", categories: ["Fixtures"] },
  { id: "fire",     label: "Fire",     categories: ["Fire Alarm"] },
  { id: "data",     label: "Data",     categories: ["Data"] },
  { id: "panels",   label: "Panels",   categories: ["Panels"] },
  { id: "boxes",    label: "Boxes",    categories: ["Boxes & Rough"] },
  { id: "lv",       label: "LV",       categories: ["Low Voltage / Misc"] },
  { id: "conduit",  label: "Conduit",  categories: ["Conduit"] },
];
