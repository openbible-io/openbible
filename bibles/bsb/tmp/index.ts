import type { Publication } from "@openbible/core";
import frt from "./frt.ts";
import books from "./generated/index.ts";
//import haysBooks from "./generated/audio/hays.ts";

const pub: Publication = {
	id: "BSB",
	title: "Berean Standard Bible",
	lang: "en",
	downloadUrl: "https://berean.bible/downloads.htm",
	license: { spdx: "CC0-1.0" },
	authors: [
		{
			name: "Gary Hill",
			url:
				"https://go.discoverybible.com/wp-content/uploads/2021/11/20181104_Bible-Discovery-HELPS-Faculty.pdf",
			qualifications: ["PhD from Trinity Evangelical Divinity School"],
			contributions: ["Advisor"],
		},
		{
			name: "Grant R. Osborne",
			url: "https://en.wikipedia.org/wiki/Grant_R._Osborne",
			qualifications: [
				"PhD from Aberdeen University",
				"Professor of New Testament at Trinity Evangelical Divinity School",
			],
			contributions: ["Advisor"],
		},
		{
			name: "Eugene H. Merrill",
			url: "https://en.wikipedia.org/wiki/Eugene_H._Merrill_(academic)",
			qualifications: [
				"PhD from Bob Jones University",
				"PhD from Columbia University",
			],
			contributions: ["Advisor"],
		},
		{
			name: "Maury Robertson",
			url: "http://gsapps.org/faculty/bio.aspx?p=MauryRobertson",
			qualifications: [
				"PhD from Golden Gate Baptist Theological Seminary",
				"M.Div. from Golden Gate Baptist Theological Seminary",
			],
			contributions: ["Advisor"],
		},
		{
			name: "Ulrik Sandborg-Petersen",
			url: "https://github.com/emg",
			contributions: ["Advisor"],
		},
		{
			name: "Baruch Korman",
			url: "https://loveisrael.org/about/",
			qualifications: [
				"PhD",
				"Senior lecturer at the Zera Abraham Institute",
			],
			contributions: ["Advisor"],
		},
		{
			name: "Gleason Archer",
			url: "https://en.wikipedia.org/wiki/Gleason_Archer_Jr.",
			qualifications: [
				"Professor at Trinity Evangelical Divinity School",
			],
			contributions: ["Extended translation notes"],
		},
	],
	publisher: "BSB Publishing",
	publisherUrl: "https://berean.bible",
	publishDate: "2024-12",
	// There have been 3 printings so far. I've marked the ones I know.
	isbns: {
		"3rd - white bonded leather": 9781944757113,
		"book block": 9781944757137,
		"3rd - tan leatherlike": 9781944757717,
		"2nd - blue hardcover": 9781944757045,
		"3rd - cowhide leather": 9781944757076,
		"3rd - tosca merlot leather": 9781944757083,
		"3rd - cowhide atlantic": 9781944757090,
	},
	books: { frt, ...books },
	audio: {
		hays: {
			downloadUrl: "https://openbible.com/audio/hays/",
			license: { spdx: "CC0-1.0" },
			authors: [{
				name: "Barry Hays",
				url: "https://openbible.com/audio/hays/",
			}],
			publisher: "Bible Hub",
			publisherUrl: "https://biblehub.com/",
			publishDate: "2022-10-07",
			url: "/audio/hays/%b/%c.webm",
			books: {},
			//books: haysBooks,
		},
	},
};

/** Metadata and data */
export default pub;
