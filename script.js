//-*- coding: iso-8859-1 -*-
'use strict';

class Clientes{

    latlon = null;
    limit = 30;
    mais = true;
    offset = 0;
    order = ['id', 'DESC'];

    //  Setar markers para os registros que estão na tela?
    mb_marker_set = false;
    
    //  Mapbox    
    mb_token = 'pk.eyJ1IjoiYml0ZWxvMTAiLCJhIjoiY2syeGQyNXZuMGFibDNvbGNuNDRoNG4yaCJ9.UpbuMafjZJFJqid9Mems9Q';
    mb_bounds = new mapboxgl.LngLatBounds(
        new mapboxgl.LngLat(-76.26115309683203, -37.55414913949015),
        new mapboxgl.LngLat(-31.62374064303117, 11.803114085670657)
    );
    mb_zoom = 3.53;
        
    constructor(){

        //localStorage.removeItem('latlon');

        //  Confere se order e limit estão em localstorage        
        ['order', 'limit'].forEach(function(e){
            
	    let valor = localStorage.getItem(e);
            if (valor) this[e] = (e == 'order') ? JSON.parse(valor) : valor;
            
        }.bind(this));

        //  Confere se latlon está no localstorage
        let latlon = localStorage.getItem('latlon');
        this.latlon = latlon ? JSON.parse(latlon) : null;
        
        //  Limit no select
        document.getElementById('limit').value = this.limit;

	//  Seta o header, inicia mapbox, faz a query inicial, e seta os eventos
	this.header_set();
        this.mb_start();
        this.query();
        this.events_set();
        
    }

    //  Funções de adição e edição registro
    add_edit_start(e){

        if (isNaN(e)){
            var tipo = 'add', id = 0;
        }else{
            var tipo = 'edit', id = e;
        }

        this.get(`dados.php?acao=add_edit_form&tipo=${tipo}&id=${id}`, function(e){

            if (!e.error && e.html){                

                document.body.insertAdjacentHTML('beforeend', e.html);
                this.modal_show();

                //  Sexo e Uf
                if (e.sexo){
                    document.getElementById(`sexo_${e.sexo}`).checked = true;
                }

                if (e.uf){
                    document.getElementById('uf').value = e.uf;
                }
                
                //  Evento CEP apenas números
                document.querySelectorAll('.cep_num').forEach(function(e){

                    e.addEventListener('keyup', function(e){
                    
                        e.target.value = e.target.value.replace(/[^0-9\.]/g,'');                    

                        if (e.target.value.length == 5){
                            document.getElementById('cep_02').focus();
                        }
                    
                    });
                    
                });                
                
            }else{   
                this.erro(e.error_data[1]);
            }            
            
        }.bind(this), 'json');          

    }

    //  Confere o CEP pelo viacep.com.br
    cep_check(){

        let cep = document.getElementById('cep_01').value + document.getElementById('cep_02').value;

        if (cep.length == 8){

            document.getElementById('cep_check_load').style.display = 'block';

            this.get(`https://viacep.com.br/ws/${cep}/json/`, function(e){

                if (!e.erro){

                    let elem = {
                        'endereco': e.logradouro,
                        'complemento': e.complemento,
                        'bairro': e.bairro,
                        'cidade': e.localidade,
                        'uf': e.uf.toUpperCase()
                    }

                    for (let k in elem){
                        document.getElementById(k).value = elem[k];
                    }
                                        
                }
                
                document.getElementById('cep_check_load').style.display = 'none';
                
            }.bind(this), 'json');

        }

    }
    
    //  Funções de configuração
    config_start(){

        this.get('form_config.html', function(html){
            
            document.body.insertAdjacentHTML('beforeend', html);
            this.modal_show();
            
        }.bind(this), 'text');          

    }

    //  Funções de remoção de registro
    delete_start(id){

        this.get('form_delete.html', function(html){
            
            document.body.insertAdjacentHTML('beforeend', html);
            this.modal_show();
            
            document.getElementById('delete_id').value = id;
            document.getElementById('delete_id_f').innerText = id;
            
        }.bind(this), 'text');          

    }


    //  Mensagem de erro
    erro(t){
        
        let erro = document.getElementById('erro');
        document.getElementById('erro_t').innerText = t;
        erro.style.visibility = 'visible';
        erro.style.opacity = 1;
        erro.addEventListener('click', this.erro_close.bind(this));        
        
    }

    erro_close(){

        let erro = document.getElementById('erro');
        erro.style.visibility = 'hidden';
        erro.style.opacity = 0;
        
    }

    //  Configura eventos
    events_set(){

        //  Header e scroll da tabela
        document.getElementById('header').addEventListener('click', this.header_change.bind(this));
        document.getElementById('tabela_scroll').addEventListener('scroll', this.paginacao.bind(this));

        //  Limit select
        document.getElementById('limit').addEventListener('change', this.limit_change.bind(this));

        //  Busca, só reset
        document.getElementById('busca').addEventListener('submit', function(e){
            
            e.preventDefault();            
            if (document.getElementById('busca_q').value.trim().length >= 2) this.reset();
            
        }.bind(this));

        //  Eventos futuros da tabela, mapa, reset da busca e fechamento da janela modal
        document.body.addEventListener('click', function(e){

            let cl = e.target.classList;
            
            if (cl.contains('ico_acao')){
                this.table_acao(e);
            }else if (cl.contains('busca_reset')){
                document.getElementById('busca_q').value = '';
                this.reset();
            }else if (cl.contains('modal_close')){
                this.modal_close();
            }else if (cl.contains('add_start') || cl.contains('edit_start')){
                this.add_edit_start(e);
            }else if (cl.contains('cep_check')){
                this.cep_check();
            }else if (cl.contains('geocode_start')){
                this.geocode_start(e);
            }
            
        }.bind(this));
        
    }

    //  Executa geocode em lat, lon
    geocode_route_set(lat, lon){

        if (this.mb_tooltip_on) this.mb_tooltip_on.remove();
        
        this.mb_route_src = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            controls: {inputs: false},
            interactive: false, 
            language: 'pt', 
            unit: 'metric',
            profile: 'mapbox/driving'
        });

        this.mb_src.addControl(this.mb_route_src, 'top-left');
        this.mb_route_src.setOrigin([this.latlon[1], this.latlon[0]]);
        this.mb_route_src.setDestination([lon, lat]);

    }

    //  Salva dados do geocode
    geocode_save(){
        
        let latlon = this.mb_geo_src.getCenter();
        
        if (latlon.lat != this.mg_geo_latlon.lat || latlon.lng != this.mg_geo_latlon.lng){
            
            this.latlon = [latlon.lat, latlon.lng];
            localStorage.setItem('latlon', JSON.stringify(this.latlon));

            let icos = document.querySelectorAll('#tabela tr td:last-child .route');

            for (let x = 0, l = icos.length; x < l; x++){                
                icos[x].classList.remove('route_off');
                icos[x].classList.add('route_on');                
            }
            
        }

        this.modal_close();
        
    }

    //  Mostra a janela e seta o local do geocode
    geocode_start(e){

        e.preventDefault();
        
        this.get('geocode_set.html', function(html){
            
            document.body.insertAdjacentHTML('beforeend', html);
            this.modal_show();

            this.mb_geo_src = new mapboxgl.Map({
                bounds: this.mb_bounds,
                dragRotate: false, 
                maxBounds: this.mb_bounds, 
                container: 'mapa_geo',
                style: 'mapbox://styles/mapbox/streets-v10',
                zoom: this.mb_zoom
            });

            this.mg_geo_latlon = this.mb_geo_src.getCenter();

            this.mb_geo_src.addControl(new MapboxGeocoder({
                accessToken: mapboxgl.accessToken,
                mapboxgl: mapboxgl
            }));

            document.getElementById('geocode_save').addEventListener('click', this.geocode_save.bind(this));
            
        }.bind(this), 'text');          
        
    }

    //  GET, 
    get(url, done = null, rt = 'json'){

        let xhr = new XMLHttpRequest();

        xhr.onload = function(e){

            if (xhr.status == 200){
     
                //  Call done
                if (done){
                    done(xhr.response);
                }

            }else{
                this.erro(`Erro ${xhr.status}: Requisição ao servidor falhou`);
            }

        }.bind(this);

        xhr.onerror = function(e){
            this.erro('Requisição ao servidor falhou');
        }.bind(this);

        xhr.responseType = rt;
        xhr.open('GET', url, true);
        xhr.send();

    }    

    //  Muda o header onclick
    header_change(e){

        let alvo = e.target, tipo = alvo.dataset.tipo;

        while (!tipo){            
            alvo = alvo.parentElement;
            tipo = alvo.dataset.tipo;            
        }

        if (tipo == this.order[0]){
            this.order[1] = this.order[1] == 'DESC' ? 'ASC' : 'DESC'; 
        }else{
            this.order[0] = tipo;
            this.order[1] = 'DESC';
        }

        localStorage.setItem('order', JSON.stringify(this.order));
        this.header_set();

        //  Reseta os dados e manda a query de novo
        this.reset();

    }

    //  Seta o header da tabela de acordo com a escolha de ordem
    header_set(){

	let header_list = document.querySelectorAll('#header > th');

        for (let x = 0, l = header_list.length; x < l; x++){
            
            let item = header_list[x], item_tipo = item.dataset.tipo;

            if (item_tipo){

                let ico = item.querySelectorAll('i')[0].classList;

                item.classList.remove(item_tipo == this.order[0] ? 'off' : 'on');
                item.classList.add(item_tipo == this.order[0] ? 'on' : 'off');

                if (item_tipo == this.order[0]){
                    
                    ico.remove(this.order[1] == 'DESC' ? 'fa-caret-up' : 'fa-caret-down')
                    ico.add(this.order[1] == 'DESC' ? 'fa-caret-down' : 'fa-caret-up')
                    
                }else{
                    
                    ico.remove('fa-caret-up');
                    ico.add('fa-caret-down');
                    
                }
                
            }
            
        }
	
    }

    //  Muda o limit
    limit_change(e){

        let limit = e.target.value;
        
        this.limit = limit;
        localStorage.setItem('limit', limit);
        this.reset();

    }

    //  Inicia mapbox
    mb_start(){

        this.mb_flying = false;
        this.mb_markers = [];
        this.mb_route_src = false;
        this.mb_tooltip_on = false;
        this.mb_tooltip_html = '';
        
        mapboxgl.accessToken = this.mb_token;
        
        this.mb_src = new mapboxgl.Map({
            bounds: this.mb_bounds,
            dragRotate: false, 
            maxBounds: this.mb_bounds, 
            container: 'mapa',
            style: 'mapbox://styles/mapbox/streets-v10',
            zoom: this.mb_zoom
        });

        //  Language
        var language = new MapboxLanguage();
        this.mb_src.addControl(language);

        //  Actions do flying
        this.mb_src.on('flyend', function(){
            this.mb_flying = false;
        }.bind(this));

        this.mb_src.on('flystart', function(){
            this.mb_flying = true;
        }.bind(this));

        this.mb_src.on('moveend', function(e){

            if (this.mb_flying){
                
                this.mb_tooltip();
                this.mb_src.fire('flyend');
                
            }
            
        }.bind(this));
        
    }

    //  Mostra o tooltip no mapa após o flyby
    mb_tooltip(){

        this.mb_tooltip_on = new mapboxgl.Popup()
            .setLngLat(this.mb_src.getCenter())
            .setHTML(this.mb_tooltip_html)
            .addTo(this.mb_src);
        
    }

    //  Janela modal
    modal_close(){

        document.body.removeChild(document.getElementById('modal'));     
        document.getElementById('overflow').style.display = 'none';

    }
    
    modal_over_click(e){

        let acao = e.target.innerText;
        document.getElementById('modal_over').style.display = 'none';

        if (acao == 'Fechar'){
            this.modal_close();
        }
    
    }
    
    modal_over_msg(tipo = 'spin', msg_01 = '', msg_02 = '', botao = null){

        let modal_over = document.getElementById('modal_over'),
            msg_01_src = modal_over.querySelector('.msg_01'),
            msg_02_src = modal_over.querySelector('.msg_02'),
            botao_src = modal_over.querySelector('.botao');
        
        //  Ícones
        ['spin', 'ok', 'erro'].forEach(function(e){
	    modal_over.querySelector(`.ico_${e}`).style.display = (e == tipo) ? 'block' : 'none';
        });

        //  Mensagens
        msg_01_src.innerText = msg_01;
        msg_01_src.style.display = msg_01.length ? 'block' : 'none';
        msg_02_src.innerText = msg_02;
        msg_02_src.style.display = msg_02.length ? 'block' : 'none';

        //  Botão
        if (botao){            
            botao_src.innerText = botao;
            botao_src.style.display = 'block';
            botao_src.addEventListener('click', this.modal_over_click.bind(this));            
        }else{
            botao_src.style.display = 'none';
        }

        modal_over.style.display = 'flex';
        
    }
    
    modal_show(){

        let modal = document.getElementById('modal');
        document.getElementById('overflow').style.display = 'block';

        modal.style.display = 'block';
        modal.style.marginTop = ((modal.offsetHeight / 2) * -1) + 'px';
        modal.style.visibility = 'visible';
        modal.style.opacity = 1;

        modal.addEventListener('submit', this.modal_submit.bind(this));        

    }

    modal_submit(e){

        event.preventDefault();
        this.modal_over_msg();

        this.post(e.target, function(e){

            if (e.error){
                
                this.modal_over_msg(
                    'erro', 
                    typeof e.error == 'object' ? e.error.join(' - ') : e.error,
                    '',
                    'Tentar Novamente'
                );
                
            }else{
                
                this.modal_over_msg('ok', e.msg_01, e.msg_02 ? e.msg_02 : '', 'Fechar');
                this.reset();
                
            }
            
        }.bind(this));

    }

    //  Vai pedir a próxima página se o scroll chegar no bottom
    paginacao(e){

        var el = event.target;
        
        if ((el.scrollHeight - el.scrollTop) === el.clientHeight && this.mais){
            this.query();
        }

    }

    //  POST. Sempre tratar o retorno como JSON
    post(form, done = null){

        let params = new FormData(form), xhr = new XMLHttpRequest();
    
        xhr.onload = function(e){

            if (xhr.status == 200){
    
                //  Call done
                if (done){
                    done(xhr.response);
                }

            }else{
                this.erro(`Erro ${xhr.status}: Requisição ao servidor falhou`);
            }

        }.bind(this);

        xhr.onerror = function(e){
            this.erro('Requisição ao servidor falhou');
        }.bind(this);

        xhr.responseType = 'json';
        xhr.open('POST', form.action, true);
        xhr.send(params);

    }
    
    //  Pede os dados do sistema
    query(){

        let order = this.order.join('-'),
            busca_q = document.getElementById('busca_q').value.trim(),
            q = (busca_q.length >= 2) ? `&q=${busca_q}` : '';

        this.get(`dados.php?acao=browse&order=${order}&lmt=${this.limit}&offset=${this.offset}${q}`, function(e){

            if (!e.error && e.data){

                if (e.data.length){                    
                    this.table_add(e.data);
                    this.offset = this.offset + this.limit;                    
                }else{
                    this.mais = false;
                }
                
            }else{

                switch (e.error_data[0]){

                    case 'no_config':
                    this.config_start();
                    break;

                    default:
                    this.erro(e.error_data[1]);
                    
                }                
                
            }
            
        }.bind(this));
        
    }

    //  Reseta tudo
    reset(){

        this.mais = true;
        this.offset = 0;

        if (this.mb_tooltip_on) this.mb_tooltip_on.remove();
        if (this.mb_route_src) this.mb_route_src.removeRoutes();
        
        this.mb_src.fitBounds(this.mb_bounds);
        this.mb_src.setZoom(this.mb_zoom);
        
        let ml = this.mb_markers.length;

        for (let x = 0; x < ml; x++){
            this.mb_markers[x].remove();
        }

        this.mb_markers = [];
        document.getElementById('tabela').innerHTML = '';
        this.query();
        
    }

    //  Ações dos ícones das tabelas
    table_acao(e){

        let id = e.target.dataset.id;

        if (!id){
        
            var tr = e.target.parentElement.parentElement,
                latlon = tr.dataset.latlon.split(' ');

            id = tr.dataset.id;

        }

        //  Map flyto
        if (e.target.classList.contains('map') && !this.mb_flying){

            if (this.mb_tooltip_on) this.mb_tooltip_on.remove();
            if (this.mb_route_src) this.mb_route_src.removeRoutes();
            
            let tds = tr.querySelectorAll('td'),
                nome = tds[1].innerText,
                cidade = tds[2].innerText,
                uf = tds[3].innerText,
                ico = [
                    `<i data-id="${id}" class="ico_acao fas fa-edit edit" title="Editar registro"></i>`,
                    `<i data-id="${id}" class="ico_acao fas fa-minus-circle del" title="Remover registro"></i>`
                ];
            
            this.mb_tooltip_html = `<div class="tooltip"><p>${nome}</p><p>${cidade} - ${uf}</p><p>${ico[0]} ${ico[1]}</p></div>`
            this.mb_src.flyTo({center: [latlon[1], latlon[0]], speed: 2, zoom: 15});
            this.mb_src.fire('flystart');

        //  Edit    
        }else if (e.target.classList.contains('edit')){
            this.add_edit_start(id);
            
        //  Delete    
        }else if (e.target.classList.contains('del')){
            this.delete_start(id);
            
        //  Seta Rota    
        }else if (e.target.classList.contains('set_route')){
            this.geocode_route_set(latlon[0], latlon[1]);            
        }

        
    }

    //  Adiciona os dados à tabela
    table_add(data){

        let html = '',
            data_l = data.length,
            ico = [
                '<i class="ico_acao fas fa-minus-circle del" title="Remover registro"></i>',
	        '<i class="ico_acao fas fa-edit edit action" title="Editar registro"></i>',
		'<i class="ico_acao fas fa-map-marker-alt action map hidemob" title="Localizar e ampliar no mapa"></i>'                
            ];

        for (let x = 0; x < data_l; x++){

            let item = data[x], 
                lat_ico = (item.lat == 0 || item.lon == 0) ? '' : ico[2];

            //  Ico da rota
            if (item.lat == 0 || item.lon == 0){
                var route_ico = '';
            }else{
                var display = this.latlon ? 'route_on' : 'route_off',
                    route_ico = `<i class="ico_acao fas fa-route action route ${display} set_route hidemob" title="Traçar a Rota"></i>`;
            }

            html += `<tr data-id="${item.id}" data-latlon="${item.lat} ${item.lon}">
                         <td>#${item.id}</td><td>${item.nome}</td><td class="hidemob">${item.cidade}</td>
                         <td class="hidemob">${item.uf}</td>
			 <td>${ico[0]}${ico[1]}${route_ico}${lat_ico}</td>
	             </tr>`;

            if (this.mb_marker_set){
            
                let marker = new mapboxgl.Marker();
                marker.setLngLat([item['lon'], item['lat']]).addTo(this.mb_src);
                this.mb_markers.push(marker);

            }
            
        }
        
        document.getElementById('tabela').insertAdjacentHTML('beforeend', html);
        
    }

}

document.addEventListener('DOMContentLoaded', function(){
    new Clientes();
});
