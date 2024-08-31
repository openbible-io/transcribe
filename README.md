# Transcriptions

Greek and Hebrew transcriptions of authoritative manuscripts.

## Authoritative Classes
1. Continuous text from an existing manuscript in original language.
2. Quotation from an existing manuscript in original language.
3. Quotation from a "time-stamped" source.

## Identifiers
Identifiers follow various accepted ones.

### Gregory-Aland (GA)
Copies of New Testamant books. Maintained by [INTF](https://www.uni-muenster.de/INTF/en/).

| Prefix 	| Type               	| Note                                      	|
|--------	|--------------------	|-------------------------------------------	|
| P      	| Papyrus            	|                                           	|
| 0      	| Parchment          	|                                           	|
| O      	| Ostracon (pottery) 	| No longer listed in "Liste Handschriften" 	|

Some manuscripts were later found to be addendums of others:
| Original 	| Addendums        	|
|----------	|------------------	|
| P15      	| P16              	|
| P49      	| P65              	|
| P64      	| P67              	|
| P77      	| P103             	|
| 029      	| 0113, 0125, 0139 	|
| 059      	| 0215             	|


### Trismegistos (TM)
Inscriptions, amulets, talismans, church father quotes, etc.

Some GA numbers were later renamed to TM numbers:
| GA         	| TM    	| Note                                	|
|------------	|-------	|-------------------------------------	|
| P7         	| 61715 	| Probably by a church father         	|
| P10        	| 61868 	| Writing exercise                    	|
| P12        	| 62312 	| Quotation in private correspondence 	|
| P50        	| 61709 	| Amulet or talisman                  	|
| P62        	| 61839 	| Various passages                    	|
| P78        	| 61695 	| Amulet or talisman                  	|
| P99        	| 61873 	| Glossary                            	|
| P80        	| 61645 	| Commentary                          	|
| 0192,11604 	| 61795 	| Quotations from a lexicon           	|
| 0212       	| 61914 	| Diatessaron                         	|
| O24        	| 61871 	|  Pottery                            	|

### Dead Sea Scrolls
[History](https://www.deadseascrolls.org.il/learn-about-the-scrolls/discovery-and-publication)

Infrared negatives have PAM (Palestine Archaeological Museum) numbers ranging from 40.059 to 44.361.
Plates containing fragments have numbers ranging from 1 to 1261.

Format `nSN`:
- `n`: number of cave if site had multiple caves with manuscripts
- `S`: abbreviation of site name
- `N`: number, starting from 1

| Site                              	| Abbreviation 	| Caves 	| Fragments 	|
|-----------------------------------	|--------------	|-------	|-----------	|
| Qumran                            	| Q            	| 11    	| 913       	|
| Wadi Murabba'at                   	| MUR          	| 1     	| 159       	|
| Nahal Hever                       	| Hev          	| 8     	| 112       	|
| Masada                            	| Mas          	| 1     	| 47        	|
| Wadi Daliyeh, Cave of Abu Shinjeh 	| WD           	| 1     	| 41        	|
| Wadi Sdeir                        	| WS           	| 1     	| 1         	|

### Critical texts
Printed amalgamations of manuscripts with punctuation.

| Abbreviation 	| Year 	| Title                          	|
|--------------	|------	|--------------------------------	|
| SR           	| 2022 	| Statistical Reconstruction     	|
| KJTR         	| 2020 	| King James Textus Receptus     	|
| RP           	| 2018 	| Robinson/Pierpont              	|
| BHP          	| 2012 	| Bunning Heuristic Prototype    	|
| NA           	| 2012 	| Nestle-Aland 28th edition      	|
| SBL          	| 2010 	| Society of Biblical Literature 	|
| WH           	| 1885 	| Westcott and Hort              	|
| ST           	| 1550 	| Stephanus                      	|

## Manuscript Encoding Specification (MES)
| Character 	| Purpose                     	| Ascii 	| Ascii description   	|
|-----------	|-----------------------------	|-------	|----------------------	|
| \         	| page break                  	| 0x5C  	| backslash            	|
| |         	| column break                	| 0x7C  	| vertical bar         	|
| /         	| line break                  	| 0x2F  	| forward slash        	|
| &         	| line remnant in lacuna      	| 0x26  	| ampersand            	|
| *         	| verse remnant in lacuna     	| 0x2A  	| asterisk             	|
| %         	| character damaged           	| 0x25  	| percent sign         	|
| ^         	| character missing           	| 0x5E  	| circumflex accent    	|
| ~         	| word supplied               	| 0x7E  	| tilde                	|
| +         	| word supplied by vid        	| 0x2B  	| plus sign            	|
| =         	| nomina sacra                	| 0x3D  	| equals sign          	|
| $         	| numeric abbreviation        	| 0x24  	| dollar sign          	|
| {         	| begin edited text           	| 0x7B  	| left curly bracket   	|
| }         	| end edited text             	| 0x7D  	| right curly bracket  	|
| x         	| original scribe uncorrected 	| 0x78  	| Latin small letter X 	|
| a         	| second scribe correction    	| 0x61  	| Latin small letter A 	|
| b         	| third scribe correction     	| 0x62  	| Latin small letter B 	|
| _         	| altered word division       	| 0x5F  	| underscore           	|
| [         	| begin questionable text     	| 0x5B  	| left square bracket  	|
| ]         	| end questionable text       	| 0x5D  	| right square bracket 	|
| +         	| verse present               	| 0x2B  	| plus sign            	|
| -         	| verse absent                	| 0x2D  	| hyphen-minus sign    	|

## Versification
- Old Testament follows Bomberg (1547).
    - Verses derived from Massoretes tradition (Leningrad 916).
    - Chapters derived from Vulgate (Robert Stephens 1509).
- New Testament follows Robert Estienne (1551).
- Format `BBCCCVVV`:
    - `BB` Book (0 = Gen, 40 = Mat)
    - `CCC` Chapter
    - `VVV` Verse

