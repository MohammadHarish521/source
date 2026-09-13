import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const neurons = sqliteTable(
  "neurons",
  {
    rootId: text("root_id").primaryKey(),
    supervoxelId: text("supervoxel_id"),
    cellType: text("cell_type"),
    hemibrainType: text("hemibrain_type"),
    superClass: text("super_class"),
    cellClass: text("cell_class"),
    cellSubClass: text("cell_sub_class"),
    superType: text("super_type"),
    flow: text("flow"),
    side: text("side"),
    nerve: text("nerve"),
    hemilineage: text("hemilineage"),
    hartensteinHemilineage: text("hartenstein_hemilineage"),
    neurotransmitter: text("neurotransmitter"),
    neurotransmitterConfidence: real("nt_confidence"),
    knownNt: text("known_nt"),
    knownNtSource: text("known_nt_source"),
    region: text("region"),
    vfbId: text("vfb_id"),
    fbbtId: text("fbbt_id"),
    status: text("status"),
    dimorphism: text("dimorphism"),
    fruDsx: text("fru_dsx"),
    synonyms: text("synonyms"),
    somaX: real("soma_x"),
    somaY: real("soma_y"),
    somaZ: real("soma_z"),
    posX: real("pos_x"),
    posY: real("pos_y"),
    posZ: real("pos_z"),
    inputSynapses: integer("input_synapses"),
    outputSynapses: integer("output_synapses"),
    inputPartners: integer("input_partners"),
    outputPartners: integer("output_partners"),
    partnerCount: integer("partner_count"),
    cableLengthNm: real("cable_length_nm"),
    skeletonNodes: integer("skeleton_nodes"),
  },
  (table) => [
    index("neurons_cell_type").on(table.cellType),
    index("neurons_super_class").on(table.superClass),
    index("neurons_cell_class").on(table.cellClass),
    index("neurons_side").on(table.side),
    index("neurons_partners").on(table.partnerCount),
  ],
);

export const edges = sqliteTable(
  "edges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pre: text("pre").notNull(),
    post: text("post").notNull(),
    synapses: integer("synapses").notNull(),
  },
  (table) => [
    index("edges_pre").on(table.pre),
    index("edges_post").on(table.post),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    handle: text("handle").notNull(),
    neuronId: text("neuron_id"),
    createdAt: integer("created_at").notNull(),
    credits: integer("credits").notNull().default(3),
    streak: integer("streak").notNull().default(0),
    lastPuzzleDay: text("last_puzzle_day"),
    favoriteRegion: text("favorite_region"),
    neuronsDiscovered: integer("neurons_discovered").notNull().default(0),
    connectionsExplored: integer("connections_explored").notNull().default(0),
    bestSixDegrees: integer("best_six_degrees"),
  },
  (table) => [uniqueIndex("users_handle").on(table.handle)],
);

export const claims = sqliteTable(
  "claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rootId: text("root_id").notNull(),
    userId: text("user_id").notNull(),
    claimNumber: integer("claim_number").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("claims_root").on(table.rootId)],
);

export const dailyPuzzles = sqliteTable("daily_puzzles", {
  day: text("day").primaryKey(),
  startId: text("start_id").notNull(),
  targetId: text("target_id").notNull(),
  shortest: integer("shortest").notNull(),
  players: integer("players").notNull().default(0),
  completions: integer("completions").notNull().default(0),
  moveSum: integer("move_sum").notNull().default(0),
});

export const puzzlePlays = sqliteTable(
  "puzzle_plays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(),
    userId: text("user_id").notNull(),
    moves: integer("moves"),
    completed: integer("completed").notNull().default(0),
    path: text("path"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("plays_day_user").on(table.day, table.userId)],
);

export const activity = sqliteTable(
  "activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    rootId: text("root_id"),
    userId: text("user_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("activity_created").on(table.createdAt)],
);

export const analytics = sqliteTable("analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event: text("event").notNull(),
  day: text("day").notNull(),
  count: integer("count").notNull().default(0),
});

export const dailyRuns = sqliteTable("daily_runs", {
  day: text("day").primaryKey(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const dailyWeights = sqliteTable("daily_weights", {
  pre: text("pre").notNull(),
  post: text("post").notNull(),
  bonus: integer("bonus").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const visits = sqliteTable(
  "visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    rootId: text("root_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("visits_user").on(table.userId), index("visits_root").on(table.rootId)],
);
