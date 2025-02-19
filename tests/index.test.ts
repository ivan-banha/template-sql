import { describe, expect, jest, test } from "@jest/globals";
import { RawQueryBuilder } from "../src/index.js";

describe("TypeORM RawQueryBuilder", () => {
  describe("Substitute named params with native params", () => {
    const rawParams = {
      id: 123,
      alias: "alias",
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(`SELECT * FROM videos WHERE id = {{ id }} AND alias = {{alias}};`)
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      expect(sql).toBe("SELECT * FROM videos WHERE id = $1 AND alias = $2;");
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([rawParams.id, rawParams.alias]);
    });
  });

  describe("Substitute fragment with SQL snippet", () => {
    const rawParams = {
      id: 123,
      alias: "alias",
      fragment_value: "1,2,3",
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(
        `
          SELECT
            id,
            ({{ #fragment_1 }}) AS fragment_1_value,
            ({{ #fragment_2 }}) AS fragment_2_value
          FROM videos
          WHERE id = {{ id }} AND alias = {{alias}};
        `
      )
      .addFragment(
        "fragment_1",
        `(SELECT * FROM STRING_TO_ARRAY('{{ fragment_value }}'::TEXT, ',');)`
      )
      .addFragment(
        "fragment_2",
        `(SELECT * FROM STRING_TO_ARRAY('4,5,6'::TEXT, ',');)`
      )
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      const resultSql = `
          SELECT
            id,
            ((SELECT * FROM STRING_TO_ARRAY('$1'::TEXT, ',');)) AS fragment_1_value,
            ((SELECT * FROM STRING_TO_ARRAY('4,5,6'::TEXT, ',');)) AS fragment_2_value
          FROM videos
          WHERE id = $2 AND alias = $3;
      `.trim();

      expect(sql).toBe(resultSql);
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([
        rawParams.fragment_value,
        rawParams.id,
        rawParams.alias,
      ]);
    });
  });

  describe("Substitute iteration block with fragment's SQL snippet", () => {
    const rawParams = {
      ids: [1, 2, 3],
      alias: "alias",
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(
        `
          SELECT id
          FROM videos 
          WHERE {{#or_loop ids}} #condition_fragment {{/or_loop}};
        `
      )
      .addFragment(
        "condition_fragment",
        `(id = {{ id }} AND alias = {{ alias }})`
      )
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      const resultSql = `
          SELECT id
          FROM videos 
          WHERE (id = $1 AND alias = $2) OR (id = $3 AND alias = $4) OR (id = $5 AND alias = $6);
      `.trim();

      expect(sql).toBe(resultSql);
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([
        rawParams.ids[0],
        rawParams.alias,
        rawParams.ids[1],
        rawParams.alias,
        rawParams.ids[2],
        rawParams.alias,
      ]);
    });
  });

  describe("Substitute iteration block with built-in SQL snippet", () => {
    const rawParams = {
      ids: [1, 2, 3],
      alias: "alias",
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(
        `
          SELECT id
          FROM videos 
          WHERE {{#or_loop ids}} (id = {{ id }} AND alias = {{ alias }}) {{/or_loop}};
        `
      )
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      const resultSql = `
          SELECT id
          FROM videos 
          WHERE (id = $1 AND alias = $2) OR (id = $3 AND alias = $4) OR (id = $5 AND alias = $6);
      `.trim();

      expect(sql).toBe(resultSql);
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([
        rawParams.ids[0],
        rawParams.alias,
        rawParams.ids[1],
        rawParams.alias,
        rawParams.ids[2],
        rawParams.alias,
      ]);
    });
  });

  describe("Test complex query with array", () => {
    const rawParams = {
      channel_ids: [
        "171d1d3b-ba54-412c-98ad-6a86a6144095",
        "171d1d3b-ba54-412c-98ad-6a86a6144096",
        "171d1d3b-ba54-412c-98ad-6a86a6144097",
      ],
      user_id: "171d1d3b-ba54-412c-98ad-6a86a6144090",
      order: "DESC",
      limit: 10,
      offset: 1,
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(
        `
          SELECT
            videos.id AS id,
            videos.video_id AS video_id,
            videos.title AS title,
            videos.thumbnail_url AS thumbnail_url,
            videos.published_at AS published_at,
            ch.id AS channel_id,
            ch.title AS channel_title,
            u_ch.keywords AS user_keywords,
            ({{ #matched_keywords }}) AS matched_keywords
          FROM videos
          JOIN channels ch ON ch.id = videos.channel_id
          JOIN user_channels u_ch ON u_ch.channel_id = videos.channel_id
          WHERE
            u_ch.user_id = {{ user_id }}
            AND videos.processing_status = 'done'
            AND (
                {{#or_loop channel_ids}}
                  (
                   (u_ch.channel_id = {{ id }} 
                    AND ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(u_ch.keywords))) && ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(videos.keywords))))
                    OR (u_ch.channel_id = {{ id }} AND TRUE = TRUE)
                  )
                {{/or_loop}}
                )
          ORDER BY published_at {{ order }}
          LIMIT {{ limit }}
          OFFSET {{ offset }};
        `
      )
      .addFragment(
        "matched_keywords",
        `
          SELECT JSONB_AGG(DISTINCT keyword) AS filtered_keywords
          FROM JSONB_ARRAY_ELEMENTS_TEXT(videos.keywords) AS keyword
          WHERE keyword IN ((SELECT * FROM JSONB_ARRAY_ELEMENTS_TEXT(u_ch.keywords)))
        `
      )
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      const resultSql = `
         SELECT
            videos.id AS id,
            videos.video_id AS video_id,
            videos.title AS title,
            videos.thumbnail_url AS thumbnail_url,
            videos.published_at AS published_at,
            ch.id AS channel_id,
            ch.title AS channel_title,
            u_ch.keywords AS user_keywords,
            (SELECT JSONB_AGG(DISTINCT keyword) AS filtered_keywords
          FROM JSONB_ARRAY_ELEMENTS_TEXT(videos.keywords) AS keyword
          WHERE keyword IN ((SELECT * FROM JSONB_ARRAY_ELEMENTS_TEXT(u_ch.keywords)))) AS matched_keywords
          FROM videos
          JOIN channels ch ON ch.id = videos.channel_id
          JOIN user_channels u_ch ON u_ch.channel_id = videos.channel_id
          WHERE
            u_ch.user_id = $1
            AND videos.processing_status = 'done'
            AND (
                (
                   (u_ch.channel_id = $2 
                    AND ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(u_ch.keywords))) && ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(videos.keywords))))
                    OR (u_ch.channel_id = $3 AND TRUE = TRUE)
                  ) OR (
                   (u_ch.channel_id = $4 
                    AND ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(u_ch.keywords))) && ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(videos.keywords))))
                    OR (u_ch.channel_id = $5 AND TRUE = TRUE)
                  ) OR (
                   (u_ch.channel_id = $6 
                    AND ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(u_ch.keywords))) && ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(videos.keywords))))
                    OR (u_ch.channel_id = $7 AND TRUE = TRUE)
                  )
                )
          ORDER BY published_at $8
          LIMIT $9
          OFFSET $10;
      `.trim();

      expect(sql).toBe(resultSql);
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([
        rawParams.user_id,
        ...rawParams.channel_ids
          .map((channel_id) => [channel_id, channel_id])
          .flat(),
        rawParams.order,
        rawParams.limit,
        rawParams.offset,
      ]);
    });
  });

  describe("Test complex query with empty array", () => {
    const rawParams = {
      channel_ids: [],
      user_id: "171d1d3b-ba54-412c-98ad-6a86a6144090",
      order: "DESC",
      limit: 10,
      offset: 1,
    };

    const [sql, params] = new RawQueryBuilder()
      .setSql(
        `
          SELECT
            videos.id AS id,
            videos.video_id AS video_id,
            videos.title AS title,
            videos.thumbnail_url AS thumbnail_url,
            videos.published_at AS published_at,
            ch.id AS channel_id,
            ch.title AS channel_title,
            u_ch.keywords AS user_keywords,
            ({{ #matched_keywords }}) AS matched_keywords
          FROM videos
          JOIN channels ch ON ch.id = videos.channel_id
          JOIN user_channels u_ch ON u_ch.channel_id = videos.channel_id
          WHERE
            u_ch.user_id = {{ user_id }}
            AND videos.processing_status = 'done'
            AND (
                {{#or_loop channel_ids}}
                  (
                    u_ch.channel_id = {{ id }} 
                    AND ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(u_ch.keywords))) && ARRAY((SELECT * FROM JSONB_ARRAY_ELEMENTS(videos.keywords)))
                  )
                {{/or_loop}}
                )
          ORDER BY published_at {{ order }}
          LIMIT {{ limit }}
          OFFSET {{ offset }};
        `
      )
      .addFragment(
        "matched_keywords",
        `
          SELECT JSONB_AGG(DISTINCT keyword) AS filtered_keywords
          FROM JSONB_ARRAY_ELEMENTS_TEXT(videos.keywords) AS keyword
          WHERE keyword IN ((SELECT * FROM JSONB_ARRAY_ELEMENTS_TEXT(u_ch.keywords)))
        `
      )
      .addParams(rawParams)
      .build();

    test("Result SQL has correct format", () => {
      const resultSql = `
          SELECT
            videos.id AS id,
            videos.video_id AS video_id,
            videos.title AS title,
            videos.thumbnail_url AS thumbnail_url,
            videos.published_at AS published_at,
            ch.id AS channel_id,
            ch.title AS channel_title,
            u_ch.keywords AS user_keywords,
            (SELECT JSONB_AGG(DISTINCT keyword) AS filtered_keywords
          FROM JSONB_ARRAY_ELEMENTS_TEXT(videos.keywords) AS keyword
          WHERE keyword IN ((SELECT * FROM JSONB_ARRAY_ELEMENTS_TEXT(u_ch.keywords)))) AS matched_keywords
          FROM videos
          JOIN channels ch ON ch.id = videos.channel_id
          JOIN user_channels u_ch ON u_ch.channel_id = videos.channel_id
          WHERE
            u_ch.user_id = $1
            AND videos.processing_status = 'done'
            AND (
                TRUE = TRUE
                )
          ORDER BY published_at $2
          LIMIT $3
          OFFSET $4;
      `.trim();

      expect(sql).toBe(resultSql);
    });

    test("Params are parsed and positioned correctly", () => {
      expect(params).toEqual([
        rawParams.user_id,
        rawParams.order,
        rawParams.limit,
        rawParams.offset,
      ]);
    });
  });
});
