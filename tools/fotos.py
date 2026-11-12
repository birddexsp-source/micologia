import hashlib, json, urllib.parse
SA2='CC BY-SA 2.0';SA3='CC BY-SA 3.0';SA4='CC BY-SA 4.0';BY3='CC BY 3.0';BY4='CC BY 4.0';CC0='CC0';PD='Dominio público'
# (ficha, especie en la foto, archivo en Commons, autor, licencia)
P=[
('amanita-phalloides','Amanita phalloides','Amanita phalloides -just emerging.JPG',"Stu's Images",SA3),
('amanita-phalloides','Amanita phalloides','Amanita phalloides (29069664382).jpg','Björn S...',SA2),
('amanita-phalloides','Amanita phalloides','Amanita phalloides (28889712950).jpg','Björn S...',SA2),
('amanita-verna-virosa','Amanita verna','Weisser-Knollenblätterpilz.jpg','Ki7sun3',CC0),
('amanita-verna-virosa','Amanita virosa','Amanita virosa UL 03.jpg','Cephas',SA4),
('amanita-verna-virosa','Amanita virosa','Amanita virosa UL 01.jpg','Cephas',SA4),
('lepiota-brunneoincarnata','Lepiota brunneoincarnata','2015-10-11 Lepiota brunneoincarnata Chodat & C. Martín 564314.jpg','Murselin Guney (Mushroom Observer)',SA3),
('lepiota-brunneoincarnata','Lepiota brunneoincarnata','Lepiota brunneoincarnata 170929w.JPG','Strobilomyces',SA4),
('lepiota-brunneoincarnata','Lepiota brunneoincarnata','Lepiota brunneoincarnata 060823w.jpg','Strobilomyces',SA3),
('galerina-marginata','Galerina marginata','Galerina marginata - Bundelmosklokje.jpg','André De Kesel',CC0),
('galerina-marginata','Galerina marginata','Galerina marginata; DSC 0662.jpg','EmillimeS',SA4),
('galerina-marginata','Galerina marginata','Galerina marginata 02.jpg','Syrio',SA4),
('cortinarius-orellanus','Cortinarius orellanus','2013-10-16 Cortinarius orellanus 1a.jpg','Andreas Kunze',SA3),
('cortinarius-orellanus','Cortinarius orellanus','Cortinarius orellanus (1).JPG','Thomas Pruß',SA3),
('cortinarius-orellanus','Cortinarius orellanus','2013-10-16 Cortinarius orellanus 1b.jpg','Andreas Kunze',SA3),
('gyromitra','Gyromitra esculenta','Gyromitra esculenta (49572178278).jpg','Lukas (Londres)',SA2),
('gyromitra','Gyromitra esculenta','Gyromitra esculenta (49572686531).jpg','Lukas (Londres)',SA2),
('gyromitra','Gyromitra esculenta','Gyromitra esculenta (27717088958).jpg','Lukas (Londres)',SA2),
('entoloma-lividum-sinuatum','Entoloma sinuatum','Entoloma sinuatum 573398400.jpg','Matej Frančeškin',BY4),
('entoloma-lividum-sinuatum','Entoloma sinuatum','Entoloma sinuatum lau.jpg','Jose Angel Urquia Goitia',SA4),
('entoloma-lividum-sinuatum','Entoloma sinuatum','Entoloma sinuatum 573398401.jpg','Matej Frančeškin',BY4),
('omphalotus-illudens','Omphalotus olearius (Europa)','Omphalotus olearius (DC.) Singer 691729.jpg','Glen van Niekerk (Mushroom Observer)',SA3),
('omphalotus-illudens','Omphalotus olearius (Europa)','Omphalotus olearius (DC.) Singer 691736.jpg','Glen van Niekerk (Mushroom Observer)',SA3),
('omphalotus-illudens','Omphalotus illudens (Norteamérica)',"081224 Jack O' Lantern NC.jpg",'Tylerbrunnermyco',SA4),
('tricholoma-pardinum','Tricholoma pardinum','2012-03-28 Tricholoma pardinum Quél 208648.jpg','David Rust (Mushroom Observer)',SA3),
('tricholoma-pardinum','Tricholoma pardinum','Tricholoma pardinum 1.jpg','Jose Angel Urquia Goitia',SA4),
('tricholoma-pardinum','Tricholoma pardinum','Tricholoma pardinum gills.jpg','Ryane Snow',SA3),
('amanita-pantherina-muscaria','Amanita pantherina','Amanita pantherina (42556666615).jpg','xulescu_g',SA2),
('amanita-pantherina-muscaria','Amanita pantherina','Amanita pantherina (30087850061).jpg','Dr. Hans-Günter Wagner',SA2),
('amanita-pantherina-muscaria','Amanita muscaria','AD2009Sep20 Amanita muscaria 02.jpg','Bernie',PD),
('paxillus-involutus','Paxillus involutus','2025-10-15 D500-0990 Achim-Lammerts Paxillus-involutus.jpg','Achim Lammerts (Syntaxys)',SA4),
('paxillus-involutus','Paxillus involutus','2021-11-14 Paxillus involutus (Flickr 51690952401).jpg','Lutz Blohm',SA2),
('paxillus-involutus','Paxillus involutus','De gewone krulzoom (Paxillus involutus). Locatie, Paddenstoelenreservaat. 11-10-2021. (actm.) 02.jpg','Agnes Monkelbaan',SA4),
('boletus-satanas','Rubroboletus satanas',"Frankenwarte 10.08.2016 Satan's Bolete - Rubroboletus satanas (29115033902).jpg",'Björn S...',SA2),
('boletus-satanas','Rubroboletus satanas',"Frankenwarte 10.08.2016 Satan's Bolete - Rubroboletus satanas (28617327643).jpg",'Björn S...',SA2),
('boletus-satanas','Rubroboletus satanas',"Frankenwarte 10.08.2016 Satan's Bolete - Rubroboletus satanas (28600649664).jpg",'Björn S...',SA2),
('coprinopsis-atramentaria','Coprinopsis atramentaria','Coprinopsis atramentaria, Syn. Coprinus atramentarius (1) (48991865448).jpg','Dr. Hans-Günter Wagner',SA2),
('coprinopsis-atramentaria','Coprinopsis atramentaria','A group of common ink cap mushrooms.jpg','Michael Palmer',SA4),
('coprinopsis-atramentaria','Coprinopsis atramentaria','Coprinopsis atramentaria (35130816925).jpg','Björn S...',SA2),
('tricholoma-equestre','Tricholoma equestre','Gąska zielonka 2927668762.jpg','Aorg1961',SA4),
('tricholoma-equestre','Tricholoma equestre','Gąska zielonka 2927673986.jpg','Aorg1961',SA4),
('tricholoma-equestre','Tricholoma equestre','Gąska zielonka 2927676032.jpg','Aorg1961',SA4),
('clitocybe-rivulosa','Clitocybe rivulosa','2016-09-14 Clitocybe rivulosa (Pers.) P. Kumm 688616.jpg','Igor Yevdokimov (Mushroom Observer)',SA3),
('clitocybe-rivulosa','Clitocybe rivulosa','Clitocybe rivulosa 2.jpg','Jose Angel Urquia Goitia',SA4),
('clitocybe-rivulosa','Clitocybe rivulosa','Clitocybe rivulosa Kiev2.jpg','Аимаина хикари',CC0),
('tylopilus-felleus','Tylopilus felleus','Hřib žlučník 6.jpg','Dezidor',BY3),
('tylopilus-felleus','Tylopilus felleus','Hořčák08088.JPG','Dendrofil',SA3),
('tylopilus-felleus','Tylopilus felleus','Loučovice, podhřib žlučový.jpg','Palickap',SA4),
('boletus-edulis','Boletus edulis','Bayerischer Spessart Naturpark, Gemeine Steinpilz (Boletus edulis).jpg','Thomas Fuhrmann',SA4),
('boletus-edulis','Boletus edulis','3 species of Boletus edilus (Eekhoorntjebrood) just beside our home Schaarsbergen - panoramio.jpg','Henk Monster',BY3),
('boletus-edulis','Boletus edulis','20141026 gewoon eekhoorntjesbrood.jpeg','Gouwenaar',SA4),
('cantharellus-cibarius','Cantharellus cibarius','Cantharellus cibarius (50199063302).jpg','Dr. Hans-Günter Wagner',SA2),
('cantharellus-cibarius','Cantharellus cibarius','Cantharellus cibarius (50198791306).jpg','Dr. Hans-Günter Wagner',SA2),
('cantharellus-cibarius','Cantharellus cibarius','Cantharellus cibarius (1) (50545288211).jpg','Dr. Hans-Günter Wagner',SA2),
('craterellus-cornucopioides','Craterellus cornucopioides','Craterellus cornucopioides (29282666045).jpg','Björn S...',SA2),
('craterellus-cornucopioides','Craterellus cornucopioides','Craterellus cornucopioides (29663417746).jpg','Björn S...',SA2),
('craterellus-cornucopioides','Craterellus cornucopioides','Craterellus cornucopioides (29206066121).jpg','Björn S...',SA2),
('hydnum-repandum','Hydnum repandum','Hydnum repandum (30096528225).jpg','Lukas (Londres)',SA2),
('hydnum-repandum','Hydnum repandum','2012-08-29 Hydnum repandum L 256175.jpg','Alan Rockefeller (Mushroom Observer)',SA3),
('hydnum-repandum','Hydnum repandum','Hedgehog mushroom (8525112768).jpg','Quinn Dombrowski',SA2),
('lactarius-deliciosus','Lactarius deliciosus','Lactarius deliciosus - Saffron Milkcap (51576323291).jpg','Lukas Large (Stourbridge)',SA2),
('lactarius-deliciosus','Lactarius deliciosus','Lactarius deliciosus, St-Quentin-en-Tourmont, Fr-80.jpg','APictche',SA4),
('lactarius-deliciosus','Lactarius deliciosus','Lactarius deliciosus (32969568682).jpg','Lukas (Londres)',SA2),
('macrolepiota-procera','Macrolepiota procera','Bedle mezi podzimním listím.jpg','Rad.dekk',SA4),
('macrolepiota-procera','Macrolepiota procera','2015-11 - Terril Saint-Charles - 26.JPG','A. Bourgeois P.',SA4),
('macrolepiota-procera','Macrolepiota procera','Champignon parasol tacheté (Macrolepiota procera).jpg','Desijwo',SA4),
('marasmius-oreades','Marasmius oreades','Marasmius oreades (38344118821).jpg','Dr. Hans-Günter Wagner',SA2),
('marasmius-oreades','Marasmius oreades','Hösel 23.07.2017 Scotch Bonnet - Marasmius oreades (36850138786).jpg','Björn S...',SA2),
('marasmius-oreades','Marasmius oreades','Marasmius oreades (24473429478).jpg','Dr. Hans-Günter Wagner',SA2),
('calocybe-gambosa','Calocybe gambosa','Calocybe gambosa (36064595975).jpg','Dr. Hans-Günter Wagner',SA2),
('calocybe-gambosa','Calocybe gambosa','Calocybe gambosa (34410861793).jpg','Björn S...',SA2),
('calocybe-gambosa','Calocybe gambosa','Calocybe gambosa (34412661523).jpg','Björn S...',SA2),
('morchella','Morchella esculenta','2026-04-04 Z5-3750E Achim-Lammerts Morchella-esculenta.jpg','Achim Lammerts (Syntaxys)',SA4),
('morchella','Morchella esculenta','Morchella esculenta (26593538756).jpg','Björn S...',SA2),
('morchella','Morchella esculenta','2026-04-05 Z5-4020E Achim-Lammerts Morchella-esculenta.jpg','Achim Lammerts (Syntaxys)',SA4),
]
LU={SA2:'https://creativecommons.org/licenses/by-sa/2.0/',SA3:'https://creativecommons.org/licenses/by-sa/3.0/',SA4:'https://creativecommons.org/licenses/by-sa/4.0/',BY3:'https://creativecommons.org/licenses/by/3.0/',BY4:'https://creativecommons.org/licenses/by/4.0/',CC0:'https://creativecommons.org/publicdomain/zero/1.0/',PD:None}
SAFE="()',;!~*$@:+-._"
def url(f):
    n=f.replace(' ','_'); h=hashlib.md5(n.encode()).hexdigest(); q=urllib.parse.quote(n,safe=SAFE)
    return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{{w}}px-{q}', 'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(n,safe=SAFE)
def por_ficha():
    d={}
    for fid,sp,f,a,l in P:
        u,pg=url(f); d.setdefault(fid,[]).append({'sp':sp,'url':u,'autor':a,'licencia':l,'licenciaUrl':LU[l],'pagina':pg,'origen':'Wikimedia Commons'})
    return d
if __name__=='__main__':
    d=por_ficha(); print(len(P),len(d))
    print(list(d.values())[0][0]['url'])
